export function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;

  const dp: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    dp[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

export function stripEmoji(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

interface CandidateScore {
  candidate: string;
  distance: number;
}

export function findBestMatches(
  query: string,
  candidates: string[],
  maxResults = 3,
  maxDistance?: number,
): string[] {
  const normalizedQuery = stripEmoji(query).toLowerCase();
  const effectiveMaxDistance = maxDistance ?? Math.max(2, Math.floor(normalizedQuery.length / 2) + 1);

  const scored: CandidateScore[] = candidates
    .map((candidate) => {
      const normalizedCandidate = stripEmoji(candidate).toLowerCase();
      return {
        candidate,
        distance: levenshteinDistance(normalizedQuery, normalizedCandidate),
      };
    })
    .filter((entry) => entry.distance <= effectiveMaxDistance)
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate));

  return scored.slice(0, maxResults).map((entry) => entry.candidate);
}
