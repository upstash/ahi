import { getBox, getBoxData } from "$lib/box.server";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const boxData = await getBoxData(params.id);
  if (!boxData) throw error(404, "Agent not found");

  const box = await getBox(params.id);

  const [files, runs, logs, schedules] = await Promise.all([
    box.files.list(),
    box.listRuns(),
    box.logs(),
    box.schedule.list(),
  ]);

  return {
    box: boxData,
    files,
    runs,
    logs,
    schedules,
  };
};
