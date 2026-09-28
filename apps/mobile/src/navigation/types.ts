import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { IdentificationResult } from '../types/identification';

export type RootStackParamList = {
  Map: undefined;
  Camera: undefined;
  Results: {
    result: IdentificationResult;
    /** Local URI of the processed photo. */
    photoUri: string;
    /** Where the photo was taken; saved as the catalog entry's location. */
    lat: number;
    lng: number;
  };
  Catalog: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
