export type PlantIdStatus = "unidentified" | "identifying" | "identified" | "failed";

export type Candidate = {
  commonName: string;
  scientificName?: string;
  confidence?: number;
  source?: string;
};

export type PlantDbRecord = {
  id: string;
  createdAt: string;
  nickname: string | null;
  imageBlob: Blob;

  idStatus: PlantIdStatus;
  identifiedAt?: string;
  candidates?: Candidate[];
  chosenCandidate?: Candidate;
};
