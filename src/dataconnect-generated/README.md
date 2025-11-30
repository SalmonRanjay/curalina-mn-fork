# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListProductsByCategory*](#listproductsbycategory)
  - [*ListMyDesignProjects*](#listmydesignprojects)
- [**Mutations**](#mutations)
  - [*CreateDesignProject*](#createdesignproject)
  - [*SaveAIDesign*](#saveaidesign)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListProductsByCategory
You can execute the `ListProductsByCategory` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listProductsByCategory(vars: ListProductsByCategoryVariables): QueryPromise<ListProductsByCategoryData, ListProductsByCategoryVariables>;

interface ListProductsByCategoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListProductsByCategoryVariables): QueryRef<ListProductsByCategoryData, ListProductsByCategoryVariables>;
}
export const listProductsByCategoryRef: ListProductsByCategoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listProductsByCategory(dc: DataConnect, vars: ListProductsByCategoryVariables): QueryPromise<ListProductsByCategoryData, ListProductsByCategoryVariables>;

interface ListProductsByCategoryRef {
  ...
  (dc: DataConnect, vars: ListProductsByCategoryVariables): QueryRef<ListProductsByCategoryData, ListProductsByCategoryVariables>;
}
export const listProductsByCategoryRef: ListProductsByCategoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listProductsByCategoryRef:
```typescript
const name = listProductsByCategoryRef.operationName;
console.log(name);
```

### Variables
The `ListProductsByCategory` query requires an argument of type `ListProductsByCategoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListProductsByCategoryVariables {
  category: string;
}
```
### Return Type
Recall that executing the `ListProductsByCategory` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListProductsByCategoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListProductsByCategoryData {
  products: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    price: number;
  } & Product_Key)[];
}
```
### Using `ListProductsByCategory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listProductsByCategory, ListProductsByCategoryVariables } from '@dataconnect/generated';

// The `ListProductsByCategory` query requires an argument of type `ListProductsByCategoryVariables`:
const listProductsByCategoryVars: ListProductsByCategoryVariables = {
  category: ..., 
};

// Call the `listProductsByCategory()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listProductsByCategory(listProductsByCategoryVars);
// Variables can be defined inline as well.
const { data } = await listProductsByCategory({ category: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listProductsByCategory(dataConnect, listProductsByCategoryVars);

console.log(data.products);

// Or, you can use the `Promise` API.
listProductsByCategory(listProductsByCategoryVars).then((response) => {
  const data = response.data;
  console.log(data.products);
});
```

### Using `ListProductsByCategory`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listProductsByCategoryRef, ListProductsByCategoryVariables } from '@dataconnect/generated';

// The `ListProductsByCategory` query requires an argument of type `ListProductsByCategoryVariables`:
const listProductsByCategoryVars: ListProductsByCategoryVariables = {
  category: ..., 
};

// Call the `listProductsByCategoryRef()` function to get a reference to the query.
const ref = listProductsByCategoryRef(listProductsByCategoryVars);
// Variables can be defined inline as well.
const ref = listProductsByCategoryRef({ category: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listProductsByCategoryRef(dataConnect, listProductsByCategoryVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.products);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.products);
});
```

## ListMyDesignProjects
You can execute the `ListMyDesignProjects` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyDesignProjects(vars: ListMyDesignProjectsVariables): QueryPromise<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;

interface ListMyDesignProjectsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMyDesignProjectsVariables): QueryRef<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;
}
export const listMyDesignProjectsRef: ListMyDesignProjectsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyDesignProjects(dc: DataConnect, vars: ListMyDesignProjectsVariables): QueryPromise<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;

interface ListMyDesignProjectsRef {
  ...
  (dc: DataConnect, vars: ListMyDesignProjectsVariables): QueryRef<ListMyDesignProjectsData, ListMyDesignProjectsVariables>;
}
export const listMyDesignProjectsRef: ListMyDesignProjectsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyDesignProjectsRef:
```typescript
const name = listMyDesignProjectsRef.operationName;
console.log(name);
```

### Variables
The `ListMyDesignProjects` query requires an argument of type `ListMyDesignProjectsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListMyDesignProjectsVariables {
  userId: UUIDString;
}
```
### Return Type
Recall that executing the `ListMyDesignProjects` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyDesignProjectsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListMyDesignProjects`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyDesignProjects, ListMyDesignProjectsVariables } from '@dataconnect/generated';

// The `ListMyDesignProjects` query requires an argument of type `ListMyDesignProjectsVariables`:
const listMyDesignProjectsVars: ListMyDesignProjectsVariables = {
  userId: ..., 
};

// Call the `listMyDesignProjects()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyDesignProjects(listMyDesignProjectsVars);
// Variables can be defined inline as well.
const { data } = await listMyDesignProjects({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyDesignProjects(dataConnect, listMyDesignProjectsVars);

console.log(data.designProjects);

// Or, you can use the `Promise` API.
listMyDesignProjects(listMyDesignProjectsVars).then((response) => {
  const data = response.data;
  console.log(data.designProjects);
});
```

### Using `ListMyDesignProjects`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyDesignProjectsRef, ListMyDesignProjectsVariables } from '@dataconnect/generated';

// The `ListMyDesignProjects` query requires an argument of type `ListMyDesignProjectsVariables`:
const listMyDesignProjectsVars: ListMyDesignProjectsVariables = {
  userId: ..., 
};

// Call the `listMyDesignProjectsRef()` function to get a reference to the query.
const ref = listMyDesignProjectsRef(listMyDesignProjectsVars);
// Variables can be defined inline as well.
const ref = listMyDesignProjectsRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyDesignProjectsRef(dataConnect, listMyDesignProjectsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.designProjects);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.designProjects);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateDesignProject
You can execute the `CreateDesignProject` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createDesignProject(vars: CreateDesignProjectVariables): MutationPromise<CreateDesignProjectData, CreateDesignProjectVariables>;

interface CreateDesignProjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDesignProjectVariables): MutationRef<CreateDesignProjectData, CreateDesignProjectVariables>;
}
export const createDesignProjectRef: CreateDesignProjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createDesignProject(dc: DataConnect, vars: CreateDesignProjectVariables): MutationPromise<CreateDesignProjectData, CreateDesignProjectVariables>;

interface CreateDesignProjectRef {
  ...
  (dc: DataConnect, vars: CreateDesignProjectVariables): MutationRef<CreateDesignProjectData, CreateDesignProjectVariables>;
}
export const createDesignProjectRef: CreateDesignProjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createDesignProjectRef:
```typescript
const name = createDesignProjectRef.operationName;
console.log(name);
```

### Variables
The `CreateDesignProject` mutation requires an argument of type `CreateDesignProjectVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateDesignProjectVariables {
  designPreferenceId: UUIDString;
  userId: UUIDString;
  projectName: string;
  roomType: string;
  status: string;
}
```
### Return Type
Recall that executing the `CreateDesignProject` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateDesignProjectData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateDesignProjectData {
  designProject_insert: DesignProject_Key;
}
```
### Using `CreateDesignProject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createDesignProject, CreateDesignProjectVariables } from '@dataconnect/generated';

// The `CreateDesignProject` mutation requires an argument of type `CreateDesignProjectVariables`:
const createDesignProjectVars: CreateDesignProjectVariables = {
  designPreferenceId: ..., 
  userId: ..., 
  projectName: ..., 
  roomType: ..., 
  status: ..., 
};

// Call the `createDesignProject()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createDesignProject(createDesignProjectVars);
// Variables can be defined inline as well.
const { data } = await createDesignProject({ designPreferenceId: ..., userId: ..., projectName: ..., roomType: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createDesignProject(dataConnect, createDesignProjectVars);

console.log(data.designProject_insert);

// Or, you can use the `Promise` API.
createDesignProject(createDesignProjectVars).then((response) => {
  const data = response.data;
  console.log(data.designProject_insert);
});
```

### Using `CreateDesignProject`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createDesignProjectRef, CreateDesignProjectVariables } from '@dataconnect/generated';

// The `CreateDesignProject` mutation requires an argument of type `CreateDesignProjectVariables`:
const createDesignProjectVars: CreateDesignProjectVariables = {
  designPreferenceId: ..., 
  userId: ..., 
  projectName: ..., 
  roomType: ..., 
  status: ..., 
};

// Call the `createDesignProjectRef()` function to get a reference to the mutation.
const ref = createDesignProjectRef(createDesignProjectVars);
// Variables can be defined inline as well.
const ref = createDesignProjectRef({ designPreferenceId: ..., userId: ..., projectName: ..., roomType: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createDesignProjectRef(dataConnect, createDesignProjectVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.designProject_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.designProject_insert);
});
```

## SaveAIDesign
You can execute the `SaveAIDesign` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
saveAiDesign(vars: SaveAiDesignVariables): MutationPromise<SaveAiDesignData, SaveAiDesignVariables>;

interface SaveAiDesignRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveAiDesignVariables): MutationRef<SaveAiDesignData, SaveAiDesignVariables>;
}
export const saveAiDesignRef: SaveAiDesignRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
saveAiDesign(dc: DataConnect, vars: SaveAiDesignVariables): MutationPromise<SaveAiDesignData, SaveAiDesignVariables>;

interface SaveAiDesignRef {
  ...
  (dc: DataConnect, vars: SaveAiDesignVariables): MutationRef<SaveAiDesignData, SaveAiDesignVariables>;
}
export const saveAiDesignRef: SaveAiDesignRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the saveAiDesignRef:
```typescript
const name = saveAiDesignRef.operationName;
console.log(name);
```

### Variables
The `SaveAIDesign` mutation requires an argument of type `SaveAiDesignVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SaveAiDesignVariables {
  id: UUIDString;
  isSaved: boolean;
}
```
### Return Type
Recall that executing the `SaveAIDesign` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SaveAiDesignData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SaveAiDesignData {
  aIDesign_update?: AIDesign_Key | null;
}
```
### Using `SaveAIDesign`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, saveAiDesign, SaveAiDesignVariables } from '@dataconnect/generated';

// The `SaveAIDesign` mutation requires an argument of type `SaveAiDesignVariables`:
const saveAiDesignVars: SaveAiDesignVariables = {
  id: ..., 
  isSaved: ..., 
};

// Call the `saveAiDesign()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await saveAiDesign(saveAiDesignVars);
// Variables can be defined inline as well.
const { data } = await saveAiDesign({ id: ..., isSaved: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await saveAiDesign(dataConnect, saveAiDesignVars);

console.log(data.aIDesign_update);

// Or, you can use the `Promise` API.
saveAiDesign(saveAiDesignVars).then((response) => {
  const data = response.data;
  console.log(data.aIDesign_update);
});
```

### Using `SaveAIDesign`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, saveAiDesignRef, SaveAiDesignVariables } from '@dataconnect/generated';

// The `SaveAIDesign` mutation requires an argument of type `SaveAiDesignVariables`:
const saveAiDesignVars: SaveAiDesignVariables = {
  id: ..., 
  isSaved: ..., 
};

// Call the `saveAiDesignRef()` function to get a reference to the mutation.
const ref = saveAiDesignRef(saveAiDesignVars);
// Variables can be defined inline as well.
const ref = saveAiDesignRef({ id: ..., isSaved: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = saveAiDesignRef(dataConnect, saveAiDesignVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.aIDesign_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.aIDesign_update);
});
```

