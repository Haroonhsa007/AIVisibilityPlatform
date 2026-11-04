// The contract omits `required` on page/list envelopes; preserve that optionality.
export interface Page<T> {
  items?: T[];
  page?: number;
  per_page?: number;
  total?: number;
  pages?: number;
}

export interface ItemList<T> {
  items?: T[];
}

export interface PageParams {
  page?: number;
  per_page?: number;
}
