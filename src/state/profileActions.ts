/** Profile CRUD routed through the service layer so remote mode persists to the backend. */
import type { ProfileInput } from '@/api/contracts/services';
import { getServices } from '@/api';
import { useLibrary } from './library';
import { useProfiles } from './profiles';

export async function createProfile(input: ProfileInput) {
  const services = getServices();
  const profile = await services.profiles.create(input);
  if (services.mode === 'remote') useProfiles.getState().replaceAll(await services.profiles.list());
  return profile;
}

export async function updateProfile(id: string, patch: Partial<ProfileInput>) {
  const services = getServices();
  await services.profiles.update(id, patch);
  if (services.mode === 'remote') useProfiles.getState().replaceAll(await services.profiles.list());
}

export async function deleteProfile(id: string) {
  const services = getServices();
  await services.profiles.remove(id);
  useLibrary.getState().removeProfileData(id);
  if (services.mode === 'remote') useProfiles.getState().replaceAll(await services.profiles.list());
}
