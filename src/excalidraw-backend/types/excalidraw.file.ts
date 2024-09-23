export type ExcalidrawFile = {
  mimeType: string;
  id: string;
  created: number;
  lastRetrieved: number;
  url: string;
};

export type ExcalidrawFileStore = {
  [id: string]: ExcalidrawFile;
};
