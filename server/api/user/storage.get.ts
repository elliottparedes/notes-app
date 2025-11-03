import { requireAuth } from '~/server/utils/auth';
import { getStorageQuota } from '~/server/utils/storage';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  
  const quota = await getStorageQuota(userId);
  
  return quota;
});

