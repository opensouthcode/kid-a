import { createContext, useContext, type PropsWithChildren } from 'react';
import conferenceJson from '../data/conference.json';
import passportActivitiesJson from '../data/passportActivities.json';
import sampleKidJson from '../data/sampleKid.json';

export type ConferenceData = {
  shortName: string;
  title: string;
};

export type PassportActivity = {
  id: number;
  isCompleted: boolean;
};

export type PassportData = {
  activities: PassportActivity[];
};

export type UserData = {
  name: string;
};

type DataLayerContextValue = {
  conference: ConferenceData;
  passport: PassportData;
  user: UserData;
};

const dataLayerValue: DataLayerContextValue = {
  conference: conferenceJson,
  passport: {
    activities: passportActivitiesJson,
  },
  user: sampleKidJson,
};

const DataLayerContext = createContext<DataLayerContextValue | undefined>(
  undefined,
);

export function DataLayerProvider({ children }: PropsWithChildren) {
  return (
    <DataLayerContext.Provider value={dataLayerValue}>
      {children}
    </DataLayerContext.Provider>
  );
}

function useDataLayer() {
  const context = useContext(DataLayerContext);

  if (!context) {
    throw new Error('useDataLayer must be used within DataLayerProvider');
  }

  return context;
}

export function useConferenceData() {
  return useDataLayer().conference;
}

export function usePassportData() {
  return useDataLayer().passport;
}

export function useUserData() {
  return useDataLayer().user;
}
