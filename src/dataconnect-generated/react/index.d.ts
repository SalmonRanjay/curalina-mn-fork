import { CreateDesignProjectData, CreateDesignProjectVariables, ListProductsByCategoryData, ListProductsByCategoryVariables, SaveAiDesignData, SaveAiDesignVariables, ListMyDesignProjectsData, ListMyDesignProjectsVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateDesignProject(options?: useDataConnectMutationOptions<CreateDesignProjectData, FirebaseError, CreateDesignProjectVariables>): UseDataConnectMutationResult<CreateDesignProjectData, CreateDesignProjectVariables>;
export function useCreateDesignProject(dc: DataConnect, options?: useDataConnectMutationOptions<CreateDesignProjectData, FirebaseError, CreateDesignProjectVariables>): UseDataConnectMutationResult<CreateDesignProjectData, CreateDesignProjectVariables>;

export function useListProductsByCategory(vars: ListProductsByCategoryVariables, options?: useDataConnectQueryOptions<ListProductsByCategoryData>): UseDataConnectQueryResult<ListProductsByCategoryData, ListProductsByCategoryVariables>;
export function useListProductsByCategory(dc: DataConnect, vars: ListProductsByCategoryVariables, options?: useDataConnectQueryOptions<ListProductsByCategoryData>): UseDataConnectQueryResult<ListProductsByCategoryData, ListProductsByCategoryVariables>;

export function useSaveAiDesign(options?: useDataConnectMutationOptions<SaveAiDesignData, FirebaseError, SaveAiDesignVariables>): UseDataConnectMutationResult<SaveAiDesignData, SaveAiDesignVariables>;
export function useSaveAiDesign(dc: DataConnect, options?: useDataConnectMutationOptions<SaveAiDesignData, FirebaseError, SaveAiDesignVariables>): UseDataConnectMutationResult<SaveAiDesignData, SaveAiDesignVariables>;

export function useListMyDesignProjects(vars: ListMyDesignProjectsVariables, options?: useDataConnectQueryOptions<ListMyDesignProjectsData>): UseDataConnectQueryResult<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;
export function useListMyDesignProjects(dc: DataConnect, vars: ListMyDesignProjectsVariables, options?: useDataConnectQueryOptions<ListMyDesignProjectsData>): UseDataConnectQueryResult<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;
