import { uid } from "./id";
import type { Project, ScheduleTask } from "./types";
import {
  defaultPropertyInfo,
  defaultUnderwriting,
} from "./underwriting";

export function defaultSchedule(): ScheduleTask[] {
  return [
    {
      id: uid("task"),
      phase: "Entitlements",
      name: "Zoning confirmation & variance package",
      start: 0,
      duration: 18,
      progress: 40,
      status: "on-track",
    },
    {
      id: uid("task"),
      phase: "Diligence",
      name: "Title cure & easement recording",
      start: 4,
      duration: 14,
      progress: 20,
      status: "on-track",
    },
    {
      id: uid("task"),
      phase: "Design",
      name: "Schematic design & unit mix lock",
      start: 10,
      duration: 16,
      progress: 10,
      status: "on-track",
    },
    {
      id: uid("task"),
      phase: "Permitting",
      name: "Building permit submission",
      start: 22,
      duration: 20,
      progress: 0,
      status: "on-track",
    },
    {
      id: uid("task"),
      phase: "Construction",
      name: "Foundation & structure",
      start: 40,
      duration: 28,
      progress: 0,
      status: "on-track",
    },
    {
      id: uid("task"),
      phase: "Construction",
      name: "Envelope & interiors",
      start: 58,
      duration: 32,
      progress: 0,
      status: "on-track",
    },
  ];
}

export function createBlankProject(
  ownerId: string,
  input: {
    name: string;
    address: string;
    region: string;
    property?: Project["property"];
    underwriting?: Project["underwriting"];
    sourceLeadId?: string;
    productType?: string;
    planNotes?: string;
  },
): Project {
  const now = new Date().toISOString();
  return {
    id: uid("proj"),
    ownerId,
    name: input.name,
    address: input.address,
    region: input.region,
    status: "planning",
    createdAt: now,
    updatedAt: now,
    documents: [],
    schedule: defaultSchedule(),
    property:
      input.property ?? defaultPropertyInfo(input.address, input.name),
    underwriting: input.underwriting ?? defaultUnderwriting(),
    sourceLeadId: input.sourceLeadId,
    productType: input.productType,
    planNotes: input.planNotes,
  };
}
