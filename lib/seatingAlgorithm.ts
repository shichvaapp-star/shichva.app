import { SeatingRequestItem, AutoSeatingResult } from "@/types/seating-request";

export interface SeatingRowData {
  id: string;
  order: number;
  desk1_right: string;
  desk1_left: string;
  desk2_right: string;
  desk2_left: string;
  desk3_right: string;
  desk3_left: string;
  desk4_right: string;
  desk4_left: string;
}

const DESK_KEYS: [keyof SeatingRowData, keyof SeatingRowData][] = [
  ["desk1_right", "desk1_left"],
  ["desk2_right", "desk2_left"],
  ["desk3_right", "desk3_left"],
  ["desk4_right", "desk4_left"],
];

interface CandidatePair {
  studentA: string;
  studentB: string;
  score: number;
  isMutual: boolean;
}

/**
 * Arranges seating based on student requests and class roster.
 * Prioritizes mutual choices, then one-way choices, and fills remaining students into empty seats.
 */
export function generateAutoSeating(
  rows: SeatingRowData[],
  roster: string[],
  requests: Record<string, SeatingRequestItem>
): AutoSeatingResult {
  // Normalize roster names
  const allStudents = Array.from(new Set(roster.map((s) => s.trim()).filter(Boolean)));
  const assignedSet = new Set<string>();

  // 1. Build Candidate Pairs
  const candidatePairs: CandidatePair[] = [];

  for (let i = 0; i < allStudents.length; i++) {
    const studentA = allStudents[i];
    const reqA = requests[studentA];
    if (!reqA || !reqA.eligible) continue;

    const c1 = reqA.choice1?.trim();
    const c2 = reqA.choice2?.trim();

    // Look at remaining students to form unique pairs (j > i for mutual, or single directions)
    for (let j = 0; j < allStudents.length; j++) {
      if (i === j) continue;
      const studentB = allStudents[j];
      const reqB = requests[studentB];
      const bIsEligible = !!reqB?.eligible;
      const bChoice1 = bIsEligible ? reqB?.choice1?.trim() : undefined;
      const bChoice2 = bIsEligible ? reqB?.choice2?.trim() : undefined;

      const aWantsBAs1 = c1 === studentB;
      const aWantsBAs2 = c2 === studentB;
      const bWantsAAs1 = bChoice1 === studentA;
      const bWantsAAs2 = bChoice2 === studentA;

      if (!aWantsBAs1 && !aWantsBAs2) continue;

      // To avoid duplicate pairs in undirected matching, ensure alphabetical order for pair key
      if (studentA > studentB) continue;

      let score = 0;
      let isMutual = false;

      if (aWantsBAs1 && bWantsAAs1) {
        score = 100;
        isMutual = true;
      } else if ((aWantsBAs1 && bWantsAAs2) || (aWantsBAs2 && bWantsAAs1)) {
        score = 80;
        isMutual = true;
      } else if (aWantsBAs2 && bWantsAAs2) {
        score = 60;
        isMutual = true;
      } else if (aWantsBAs1) {
        score = 30;
      } else if (aWantsBAs2) {
        score = 15;
      }

      if (score > 0) {
        candidatePairs.push({
          studentA,
          studentB,
          score,
          isMutual,
        });
      }
    }
  }

  // Also check if any student B picked student A as choice 1/2 where A did not pick B,
  // and we haven't included that directed pair yet (when studentA > studentB)
  for (let i = 0; i < allStudents.length; i++) {
    const studentA = allStudents[i];
    const reqA = requests[studentA];
    if (!reqA || !reqA.eligible) continue;

    const c1 = reqA.choice1?.trim();
    const c2 = reqA.choice2?.trim();

    for (let j = 0; j < allStudents.length; j++) {
      if (i === j) continue;
      const studentB = allStudents[j];
      // If studentA > studentB and B didn't pick A, this pair was skipped above
      if (studentA <= studentB) continue;

      const reqB = requests[studentB];
      const bChoice1 = reqB?.eligible ? reqB?.choice1?.trim() : undefined;
      const bChoice2 = reqB?.eligible ? reqB?.choice2?.trim() : undefined;

      const aWantsBAs1 = c1 === studentB;
      const aWantsBAs2 = c2 === studentB;
      const bWantsA = bChoice1 === studentA || bChoice2 === studentA;

      // Only add if B did NOT want A (if B wanted A, it was already handled when i was studentB)
      if (!bWantsA && (aWantsBAs1 || aWantsBAs2)) {
        candidatePairs.push({
          studentA: studentB,
          studentB: studentA,
          score: aWantsBAs1 ? 30 : 15,
          isMutual: false,
        });
      }
    }
  }

  // Sort candidate pairs: highest score first, with tie breaking
  candidatePairs.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.studentA.localeCompare(b.studentA, "he");
  });

  const deskPairs: [string, string][] = [];
  let mutualPairsCount = 0;
  let oneWayCount = 0;

  // 2. Greedily select top scoring pairs
  for (const pair of candidatePairs) {
    if (!assignedSet.has(pair.studentA) && !assignedSet.has(pair.studentB)) {
      assignedSet.add(pair.studentA);
      assignedSet.add(pair.studentB);
      deskPairs.push([pair.studentA, pair.studentB]);

      if (pair.isMutual) {
        mutualPairsCount++;
      } else {
        oneWayCount++;
      }
    }
  }

  // 3. Collect remaining unassigned students
  const remaining = allStudents
    .filter((name) => !assignedSet.has(name))
    // Randomize unassigned order slightly so placement is diverse
    .sort(() => Math.random() - 0.5);

  // Group remaining into pairs
  while (remaining.length >= 2) {
    const s1 = remaining.pop()!;
    const s2 = remaining.pop()!;
    assignedSet.add(s1);
    assignedSet.add(s2);
    deskPairs.push([s1, s2]);
  }

  // If 1 student is left over
  if (remaining.length === 1) {
    const s1 = remaining.pop()!;
    assignedSet.add(s1);
    deskPairs.push([s1, ""]);
  }

  // 4. Fill deskPairs into classroom rows
  // Starting from rows closest to the board (order 5 down to 1 in standard layout)
  const updatedRows: SeatingRowData[] = rows.map((r) => ({
    ...r,
    desk1_right: "",
    desk1_left: "",
    desk2_right: "",
    desk2_left: "",
    desk3_right: "",
    desk3_left: "",
    desk4_right: "",
    desk4_left: "",
  }));

  // Sort rows ascending by order so order 5 is at the end or order 1 at the beginning
  // Note: we place starting from front row (lowest order or reversed as in randomizeSeating)
  const sortedRowIndices = updatedRows
    .map((_, idx) => idx)
    .reverse(); // Start from the front of the classroom (closest to board)

  let pairIndex = 0;

  for (const rowIdx of sortedRowIndices) {
    for (const [rKey, lKey] of DESK_KEYS) {
      if (pairIndex < deskPairs.length) {
        const [student1, student2] = deskPairs[pairIndex];
        (updatedRows[rowIdx][rKey] as string) = student1;
        (updatedRows[rowIdx][lKey] as string) = student2;
        pairIndex++;
      }
    }
  }

  const totalPlaced = assignedSet.size;
  const unassignedCount = allStudents.length - totalPlaced;

  return {
    updatedRows,
    mutualPairsCount,
    oneWayCount,
    totalPlaced,
    unassignedCount,
  };
}
