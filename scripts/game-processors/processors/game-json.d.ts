// Raw export rows are untyped JSON (FModel/CUE4Parse DataTables). Entries/values of those
// objects stay `any` instead of `unknown` so processors can read fields without casts.
interface ObjectConstructor {
  entries(o: any): [string, any][];
  values(o: any): any[];
}
