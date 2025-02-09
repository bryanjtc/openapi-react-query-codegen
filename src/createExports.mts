import type { UserConfig } from "@hey-api/openapi-ts";
import type { Project } from "ts-morph";
import ts from "typescript";
import { capitalizeFirstLetter } from "./common.mjs";
import { modelsFileName } from "./constants.mjs";
import { createPrefetchOrEnsure } from "./createPrefetchOrEnsure.mjs";
import { createUseMutation } from "./createUseMutation.mjs";
import { createUseQuery } from "./createUseQuery.mjs";
import type { Service } from "./service.mjs";

export const createExports = ({
  service,
  client,
  project,
  pageParam,
  nextPageParam,
  initialPageParam,
}: {
  service: Service;
  client: UserConfig["client"];
  project: Project;
  pageParam: string;
  nextPageParam: string;
  initialPageParam: string;
}) => {
  const { methods } = service;
  const methodDataNames = methods.reduce(
    (acc, data) => {
      const methodName = data.method.getName();
      acc[`${capitalizeFirstLetter(methodName)}Data`] = methodName;
      return acc;
    },
    {} as { [key: string]: string },
  );
  const modelsFile = project
    .getSourceFiles?.()
    .find((sourceFile) => sourceFile.getFilePath().includes(modelsFileName));

  const modelDeclarations = modelsFile?.getExportedDeclarations();
  const entries = modelDeclarations?.entries();
  const modelNames: string[] = [];
  const paginatableMethods: string[] = [];
  for (const [key, value] of entries ?? []) {
    modelNames.push(key);
    const node = value[0].compilerNode;
    if (ts.isTypeAliasDeclaration(node) && methodDataNames[key] !== undefined) {
      // get the type alias declaration
      const typeAliasDeclaration = node.type;
      if (typeAliasDeclaration.kind === ts.SyntaxKind.TypeLiteral) {
        const query = (typeAliasDeclaration as ts.TypeLiteralNode).members.find(
          (m) =>
            m.kind === ts.SyntaxKind.PropertySignature &&
            m.name?.getText() === "query",
        );
        if (
          query &&
          ((query as ts.PropertySignature).type as ts.TypeLiteralNode).members
            .map((m) => m.name?.getText())
            .includes(pageParam)
        ) {
          paginatableMethods.push(methodDataNames[key]);
        }
      }
    }
  }

  const allGet = methods.filter((m) =>
    m.httpMethodName.toUpperCase().includes("GET"),
  );
  const allPost = methods.filter((m) =>
    m.httpMethodName.toUpperCase().includes("POST"),
  );
  const allPut = methods.filter((m) =>
    m.httpMethodName.toUpperCase().includes("PUT"),
  );
  const allPatch = methods.filter((m) =>
    m.httpMethodName.toUpperCase().includes("PATCH"),
  );
  const allDelete = methods.filter((m) =>
    m.httpMethodName.toUpperCase().includes("DELETE"),
  );

  const allGetQueries = allGet.map((m) =>
    createUseQuery({
      functionDescription: m,
      client,
      pageParam,
      nextPageParam,
      initialPageParam,
      paginatableMethods,
      modelNames,
    }),
  );
  const allPrefetchQueries = allGet.map((m) =>
    createPrefetchOrEnsure({ ...m, functionType: "prefetch", modelNames }),
  );
  const allEnsureQueries = allGet.map((m) =>
    createPrefetchOrEnsure({ ...m, functionType: "ensure", modelNames }),
  );

  const allPostMutations = allPost.map((m) =>
    createUseMutation({ functionDescription: m, modelNames, client }),
  );
  const allPutMutations = allPut.map((m) =>
    createUseMutation({ functionDescription: m, modelNames, client }),
  );
  const allPatchMutations = allPatch.map((m) =>
    createUseMutation({ functionDescription: m, modelNames, client }),
  );
  const allDeleteMutations = allDelete.map((m) =>
    createUseMutation({ functionDescription: m, modelNames, client }),
  );

  const allQueries = [...allGetQueries];
  const allMutations = [
    ...allPostMutations,
    ...allPutMutations,
    ...allPatchMutations,
    ...allDeleteMutations,
  ];

  const commonInQueries = allQueries.flatMap(
    ({ apiResponse, returnType, key, queryKeyFn }) => [
      apiResponse,
      returnType,
      key,
      queryKeyFn,
    ],
  );
  const commonInMutations = allMutations.flatMap(
    ({ mutationResult, key, mutationKeyFn }) => [
      mutationResult,
      key,
      mutationKeyFn,
    ],
  );

  const allCommon = [...commonInQueries, ...commonInMutations];

  const mainQueries = allQueries.flatMap(({ queryHook }) => [queryHook]);
  const mainMutations = allMutations.flatMap(({ mutationHook }) => [
    mutationHook,
  ]);

  const mainExports = [...mainQueries, ...mainMutations];

  const infiniteQueriesExports = allQueries
    .flatMap(({ infiniteQueryHook }) => [infiniteQueryHook])
    .filter(Boolean) as ts.VariableStatement[];

  const suspenseQueries = allQueries.flatMap(({ suspenseQueryHook }) => [
    suspenseQueryHook,
  ]);

  const suspenseExports = [...suspenseQueries];

  const allPrefetches = allPrefetchQueries.flatMap(({ hook }) => [hook]);

  const allEnsures = allEnsureQueries.flatMap(({ hook }) => [hook]);

  const allPrefetchExports = [...allPrefetches];

  return {
    /**
     * Common types and variables between queries (regular and suspense) and mutations
     */
    allCommon,
    /**
     * Main exports are the hooks that are used in the components
     */
    mainExports,
    /**
     * Infinite queries exports are the hooks that are used in the infinite scroll components
     */
    infiniteQueriesExports,
    /**
     * Suspense exports are the hooks that are used in the suspense components
     */
    suspenseExports,
    /**
     * Prefetch exports are the hooks that are used in the prefetch components
     */
    allPrefetchExports,

    /**
     * Ensure exports are the hooks that are used in the loader components
     */
    allEnsures,
  };
};
