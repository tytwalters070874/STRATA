import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { IdentificationResult } from '../types/identification';
import { supabase } from './supabase';

export const ROCK_PHOTOS_BUCKET = 'rock-photos';

// Claude downsamples anything larger than ~1568 px on the long edge, so
// bigger uploads only cost bandwidth in the field.
const MAX_EDGE_PX = 1568;
const JPEG_QUALITY = 0.85;

export type IdentifyStage = 'preparing' | 'uploading' | 'identifying';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface IdentifyInput {
  photo: CapturedPhoto;
  userId: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  onStage?: (stage: IdentifyStage) => void;
}

export interface IdentifyOutput {
  result: IdentificationResult;
  /** Local URI of the processed (EXIF-free) photo, for display. */
  photoUri: string;
  photoPath: string;
}

/**
 * Resizes and re-encodes the photo. Re-encoding from pixels writes a fresh
 * JPEG without the camera's EXIF block, which drops GPS coordinates, device
 * model and timestamps before the photo leaves the phone.
 */
async function preparePhoto(photo: CapturedPhoto) {
  const context = ImageManipulator.manipulate(photo.uri);
  const longEdge = Math.max(photo.width, photo.height);
  if (longEdge > MAX_EDGE_PX) {
    context.resize(photo.width >= photo.height ? { width: MAX_EDGE_PX } : { height: MAX_EDGE_PX });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  const bytes = await new File(saved.uri).arrayBuffer();
  return { uri: saved.uri, bytes };
}

/** Best-effort cleanup; a leftover photo is not worth surfacing an error for. */
async function removeUploadedPhoto(photoPath: string) {
  const { error } = await supabase.storage.from(ROCK_PHOTOS_BUCKET).remove([photoPath]);
  if (error) console.warn('Could not remove uploaded photo', error);
}

const timeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

interface FunctionErrorBody {
  error?: string;
  code?: string;
  retry_at?: string | null;
}

async function readFunctionError(error: unknown): Promise<{ message: string; code: string | null }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: FunctionErrorBody = await error.context.json();
      if (body.code === 'daily_limit') {
        const when = body.retry_at ? ` You can identify again ${timeFormat.format(new Date(body.retry_at))}.` : '';
        return { message: `You've reached today's identification limit.${when}`, code: body.code };
      }
      if (typeof body.error === 'string') return { message: body.error, code: body.code ?? null };
    } catch {
      // Fall through to the generic message.
    }
  }
  return { message: error instanceof Error ? error.message : 'Identification failed', code: null };
}

export async function identifyRock({
  photo,
  userId,
  lat,
  lng,
  accuracyM,
  onStage,
}: IdentifyInput): Promise<IdentifyOutput> {
  onStage?.('preparing');
  const prepared = await preparePhoto(photo);

  onStage?.('uploading');
  const photoPath = `${userId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(ROCK_PHOTOS_BUCKET)
    .upload(photoPath, prepared.bytes, { contentType: 'image/jpeg' });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

  onStage?.('identifying');
  // The function reads the photo from Storage, so it is uploaded only once.
  const { data, error } = await supabase.functions.invoke<IdentificationResult>('identify-rock', {
    body: {
      lat,
      lng,
      accuracy_m: accuracyM ?? undefined,
      photo_path: photoPath,
    },
  });
  if (error || !data) {
    // A result we never received can't be saved to the catalog, so its photo
    // is useless. The function also removes photos for failed and limited
    // attempts; this covers network failures it never sees.
    await removeUploadedPhoto(photoPath);
    if (!error) throw new Error('Identification returned no result');
    const { message } = await readFunctionError(error);
    throw new Error(message);
  }

  return { result: data, photoUri: prepared.uri, photoPath };
}
