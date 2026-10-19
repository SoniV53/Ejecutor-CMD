export interface DocParameter {
  id: string;
  name: string;
  type: string;
  description: string;
}

export interface DocMethod {
  id: string;
  name: string;
  details: string;
  description: string;
}

export interface DocVariantProp {
  parameterId: string;
  value: string;
}

export interface DocVariant {
  id: number;
  name: string;
  description: string;
  image: string | null;
  selectedProperties: DocVariantProp[];
}

export interface DocCommit {
  id: string;
  title: string;
  hash: string;
}

export interface DocFormData {
  name: string;
  subtitle: string;
  description: string;
  status: string;
  historyCommits: DocCommit[];
  globalParameters: DocParameter[];
  methods: DocMethod[];
  variants: DocVariant[];
}
