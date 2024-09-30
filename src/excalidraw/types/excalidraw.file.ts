export type ExcalidrawFile = {
  mimeType: string;
  id: string;
  created: number;
  lastRetrieved: number;
  url?: string;
  dataURL: string;
};

export type ExcalidrawFileStore = {
  [id: string]: ExcalidrawFile;
};
