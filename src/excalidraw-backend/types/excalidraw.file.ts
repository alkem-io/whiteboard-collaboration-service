export type ExcalidrawFile = {
  mimeType: string;
  id: string;
  dataURL: string;
  created: number;
  lastRetrieved: number;
  url: string;
};

export type ExcalidrawFileStore = {
  [id: string]: ExcalidrawFile;
};
