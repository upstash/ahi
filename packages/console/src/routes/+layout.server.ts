import { listBoxes } from "$lib/box.server";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async () => {
  const agents = await listBoxes();
  return { agents };
};
