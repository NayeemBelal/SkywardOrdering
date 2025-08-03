import { Admin, Resource, List, Datagrid, TextField, Edit, SimpleForm, TextInput } from 'react-admin';
import dataProvider from './dataProvider';

const SimpleList = (props:any) => (
  <List {...props}>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="name" />
    </Datagrid>
  </List>
);

const RequestList = () => (
  <List>
    <Datagrid>
      <TextField source="id" />
      <TextField source="submitted_at" />
      <TextField source="xlsx_path" />
    </Datagrid>
  </List>
);

export default function AdminApp() {
  return (
    <Admin dataProvider={dataProvider}>
      <Resource name="sites" list={SimpleList} edit={()=>(
        <Edit><SimpleForm><TextInput source="name" /></SimpleForm></Edit>
      )} />
      <Resource name="employees" list={props=>(
        <List {...props}><Datagrid rowClick="edit"><TextField source="id" /><TextField source="full_name" /></Datagrid></List>
      )} edit={()=>(
        <Edit><SimpleForm><TextInput source="full_name" /></SimpleForm></Edit>
      )} />
      <Resource name="items" list={props=>(
        <List {...props}><Datagrid rowClick="edit"><TextField source="id" /><TextField source="name_es" /><TextField source="sku" /></Datagrid></List>
      )} edit={()=>(
        <Edit><SimpleForm><TextInput source="name_es" /><TextInput source="name_en" /><TextInput source="sku" /></SimpleForm></Edit>
      )} />
      <Resource name="requests" list={RequestList} />
    </Admin>
  );
}
