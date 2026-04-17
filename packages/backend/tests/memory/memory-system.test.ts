import { describe, it, expect, beforeEach, vi } from "vitest";
import { formatExistingMemories } from "../../src/services/memory/extractor.js";
import { formatMemoriesForPrompt } from "../../src/services/memory/context-builder.js";
import { MemoryRepository } from "../../src/repositories/memory-repository.js";

// Mock prisma
const mockMemoryItem = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
};

const mockMemorySnapshot = {
  upsert: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
};

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    memoryItem: mockMemoryItem,
    memorySnapshot: mockMemorySnapshot,
  },
}));

describe("Memory System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatExistingMemories", () => {
    it("formats memories correctly", () => {
      const memories = [
        { type: "CHARACTER", title: "李明", content: "30岁科学家" },
        { type: "LOCATION", title: "实验室", content: "现代化实验室" },
      ];

      const result = formatExistingMemories(memories);

      expect(result).toContain("[CHARACTER] 李明: 30岁科学家");
      expect(result).toContain("[LOCATION] 实验室: 现代化实验室");
    });

    it("returns empty string for no memories", () => {
      expect(formatExistingMemories([])).toBe("");
    });
  });

  describe("formatMemoriesForPrompt", () => {
    it("formats memory items for prompt", () => {
      const memories = [
        {
          id: "1",
          type: "CHARACTER",
          title: "李明",
          content: "30岁科学家，聪明机智",
          projectId: "p1",
          category: null,
          metadata: null,
          embedding: [],
          relatedIds: [],
          episodeId: null,
          tags: [],
          importance: 3,
          isActive: true,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = formatMemoriesForPrompt(memories as any);

      expect(result).toContain("[CHARACTER] 李明: 30岁科学家，聪明机智");
    });

    it("truncates long content", () => {
      const longContent = "a".repeat(300);
      const memories = [
        {
          id: "1",
          type: "EVENT",
          title: "测试事件",
          content: longContent,
          projectId: "p1",
          category: null,
          metadata: null,
          embedding: [],
          relatedIds: [],
          episodeId: null,
          tags: [],
          importance: 3,
          isActive: true,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = formatMemoriesForPrompt(memories as any);

      expect(result.length).toBeLessThan(longContent.length);
      expect(result).toContain("...");
    });

    it("returns message for empty memories", () => {
      expect(formatMemoriesForPrompt([])).toBe("（无记忆）");
    });
  });

  // Note: Repository tests require proper Prisma mocking setup
  // For now, we test the pure utility functions
  // Repository integration tests should be added with proper database test setup
});
