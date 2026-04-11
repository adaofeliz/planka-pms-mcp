import type { PlankaConfig } from "../config/types.js";
import { findBestMatches, levenshteinDistance, stripEmoji } from "../utils/levenshtein.js";
import { AmbiguousMatchError, ConfigError, NotFoundError } from "../utils/errors.js";
import type {
  PlankaCustomField,
  PlankaLabel,
  PlankaList,
  PlankaUser,
} from "./types.js";
import type { BoardSkeleton } from "./cache.js";

type Matchable = {
  id: string;
  name: string;
};

function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return stripEmoji(value)
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function ensureUniqueBestMatch(query: string, candidates: string[]): void {
  const normalizedQuery = normalizeName(query);

  const prefixMatches = candidates.filter((candidate) => normalizeName(candidate).startsWith(normalizedQuery));
  if (normalizedQuery.length >= 2 && prefixMatches.length > 1) {
    throw new AmbiguousMatchError(
      `Ambiguous match for '${query}'. Multiple candidates share the same prefix.`,
      prefixMatches,
      prefixMatches,
    );
  }

  const distances = candidates.map((candidate) => ({
    candidate,
    distance: levenshteinDistance(normalizedQuery, normalizeName(candidate)),
  }));

  const minDistance = Math.min(...distances.map((entry) => entry.distance));
  const tied = distances.filter((entry) => entry.distance === minDistance).map((entry) => entry.candidate);

  if (minDistance <= Math.max(2, Math.floor(normalizedQuery.length / 2) + 1) && tied.length > 1) {
    throw new AmbiguousMatchError(
      `Ambiguous match for '${query}'. Multiple candidates are equally close.`,
      tied,
      tied,
    );
  }
}

export class NameResolver {
  constructor(
    private readonly skeleton: BoardSkeleton,
    private readonly config: PlankaConfig,
  ) {}

  resolveListId(name: string): string {
    const lists = this.skeleton.lists.filter((l): l is PlankaList & { name: string } => l.name !== null);
    return this.resolveEntity("list", name, lists).id;
  }

  resolveLabelId(name: string): string {
    const labels = this.skeleton.labels.filter((l): l is PlankaLabel & { name: string } => l.name !== null);
    return this.resolveEntity("label", name, labels).id;
  }

  resolveMemberId(name: string): string {
    const members: Matchable[] = this.skeleton.members.map((member) => ({
      id: member.id,
      name: member.name,
    }));

    const usernameAliases: Matchable[] = this.skeleton.members.map((member) => ({
      id: member.id,
      name: member.username,
    }));

    return this.resolveEntity("member", name, [...members, ...usernameAliases]).id;
  }

  resolveCustomFieldId(name: string): string {
    return this.resolveEntity("custom field", name, this.skeleton.customFields).id;
  }

  resolveInboxListId(): string {
    return this.resolveConfiguredRoleListId("inbox");
  }

  resolveDoneListId(): string {
    return this.resolveConfiguredRoleListId("done");
  }

  resolveBlockedListId(): string {
    return this.resolveConfiguredRoleListId("blocked");
  }

  resolveTodayListId(): string {
    return this.resolveConfiguredRoleListId("today");
  }

  resolveArchiveListId(): string {
    if (!this.skeleton.archiveListId) {
      throw new ConfigError("Archive list is not available in board skeleton.");
    }

    return this.skeleton.archiveListId;
  }

  private resolveConfiguredRoleListId(role: "inbox" | "done" | "blocked" | "today"): string {
    const configuredName = this.config.board.lists[role];
    if (!configuredName) {
      throw new ConfigError(`Missing required semantic role mapping for '${role}'.`);
    }

    return this.resolveListId(configuredName);
  }

  private resolveEntity<T extends Matchable>(kind: string, query: string, entities: T[]): T {
    const normalizedQuery = normalizeName(query);
    const exactMatches = entities.filter((entity) => normalizeName(entity.name) === normalizedQuery);

    if (exactMatches.length === 1) {
      return exactMatches[0];
    }

    if (exactMatches.length > 1) {
      throw new AmbiguousMatchError(`Ambiguous ${kind} '${query}'.`, exactMatches.map((entity) => entity.name));
    }

    const available = entities.map((entity) => entity.name);
    ensureUniqueBestMatch(query, available);

    const suggestions = findBestMatches(query, available);
    throw new NotFoundError(`${kind} '${query}' was not found.`, available, suggestions);
  }
}

export type ResolverList = PlankaList;
export type ResolverLabel = PlankaLabel;
export type ResolverMember = PlankaUser;
export type ResolverCustomField = PlankaCustomField;
