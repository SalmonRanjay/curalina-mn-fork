import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AIDesign_Key {
  id: UUIDString;
  __typename?: 'AIDesign_Key';
}

export interface CreateDesignProjectData {
  designProject_insert: DesignProject_Key;
}

export interface CreateDesignProjectVariables {
  designPreferenceId: UUIDString;
  userId: UUIDString;
  projectName: string;
  roomType: string;
  status: string;
}

export interface DesignPreference_Key {
  id: UUIDString;
  __typename?: 'DesignPreference_Key';
}

export interface DesignProduct_Key {
  aiDesignId: UUIDString;
  productId: UUIDString;
  __typename?: 'DesignProduct_Key';
}

export interface DesignProject_Key {
  id: UUIDString;
  __typename?: 'DesignProject_Key';
}

export interface ListMyDesignProjectsData {
  designProjects: ({
    id: UUIDString;
    projectName: string;
    description?: string | null;
    imageUrl?: string | null;
    roomType: string;
    status: string;
    createdAt: TimestampString;
  } & DesignProject_Key)[];
}

export interface ListMyDesignProjectsVariables {
  userId: UUIDString;
}

export interface ListProductsByCategoryData {
  products: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    price: number;
  } & Product_Key)[];
}

export interface ListProductsByCategoryVariables {
  category: string;
}

export interface Product_Key {
  id: UUIDString;
  __typename?: 'Product_Key';
}

export interface SaveAiDesignData {
  aIDesign_update?: AIDesign_Key | null;
}

export interface SaveAiDesignVariables {
  id: UUIDString;
  isSaved: boolean;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateDesignProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDesignProjectVariables): MutationRef<CreateDesignProjectData, CreateDesignProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateDesignProjectVariables): MutationRef<CreateDesignProjectData, CreateDesignProjectVariables>;
  operationName: string;
}
export const createDesignProjectRef: CreateDesignProjectRef;

export function createDesignProject(vars: CreateDesignProjectVariables): MutationPromise<CreateDesignProjectData, CreateDesignProjectVariables>;
export function createDesignProject(dc: DataConnect, vars: CreateDesignProjectVariables): MutationPromise<CreateDesignProjectData, CreateDesignProjectVariables>;

interface ListProductsByCategoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListProductsByCategoryVariables): QueryRef<ListProductsByCategoryData, ListProductsByCategoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListProductsByCategoryVariables): QueryRef<ListProductsByCategoryData, ListProductsByCategoryVariables>;
  operationName: string;
}
export const listProductsByCategoryRef: ListProductsByCategoryRef;

export function listProductsByCategory(vars: ListProductsByCategoryVariables): QueryPromise<ListProductsByCategoryData, ListProductsByCategoryVariables>;
export function listProductsByCategory(dc: DataConnect, vars: ListProductsByCategoryVariables): QueryPromise<ListProductsByCategoryData, ListProductsByCategoryVariables>;

interface SaveAiDesignRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveAiDesignVariables): MutationRef<SaveAiDesignData, SaveAiDesignVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveAiDesignVariables): MutationRef<SaveAiDesignData, SaveAiDesignVariables>;
  operationName: string;
}
export const saveAiDesignRef: SaveAiDesignRef;

export function saveAiDesign(vars: SaveAiDesignVariables): MutationPromise<SaveAiDesignData, SaveAiDesignVariables>;
export function saveAiDesign(dc: DataConnect, vars: SaveAiDesignVariables): MutationPromise<SaveAiDesignData, SaveAiDesignVariables>;

interface ListMyDesignProjectsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMyDesignProjectsVariables): QueryRef<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListMyDesignProjectsVariables): QueryRef<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;
  operationName: string;
}
export const listMyDesignProjectsRef: ListMyDesignProjectsRef;

export function listMyDesignProjects(vars: ListMyDesignProjectsVariables): QueryPromise<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;
export function listMyDesignProjects(dc: DataConnect, vars: ListMyDesignProjectsVariables): QueryPromise<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;

