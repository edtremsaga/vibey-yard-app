export type PlantIdStatus = "unidentified" | "identifying" | "identified" | "failed";

export type Candidate = {
  commonName: string;
  scientificName?: string;
  confidence?: number;
  source?: string;
};

export type PlantImage = {
  id: string;
  createdAt: string;
  blob: Blob;
};

export type PlantDbRecord = {
  id: string;
  createdAt: string;
  nickname: string | null;
  images: PlantImage[];

  idStatus: PlantIdStatus;
  identifiedAt?: string;
  candidates?: Candidate[];
  chosenCandidate?: Candidate;
};
