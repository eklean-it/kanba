import { describe, expect, it } from "vitest";
import { summarizeBoards, type BoardRow, type MemberRow, type TaskRow, type PersonRow } from "@/lib/board-summary";

// Erykah, 2026-08-18: "Am I able to see all the teams dashboards?" She was told
// yes. She could not — RLS scopes projects to owner-or-member and the
// SUPER_ADMIN_EMAILS allowlist grants no board visibility. This is the shaping
// behind the read-only overview that makes the answer true.

const PEOPLE: PersonRow[] = [
  { id: "u-erykah", email: "erykah@eklean.com", full_name: "Erykah" },
  { id: "u-jared", email: "jared@eklean.com", full_name: "Jared" },
  { id: "u-bryan", email: "bryan@eklean.com", full_name: "Bryan" },
];

const BOARDS: BoardRow[] = [
  { id: "b-ops", name: "Ops", slug: "ops", created_at: "2026-07-10", owner_user_id: "u-jared" },
  { id: "b-quiet", name: "Quiet", slug: "quiet", created_at: "2026-07-11", owner_user_id: "u-bryan" },
];

describe("summarizeBoards", () => {
  it("returns every board, including ones the viewer is not on", () => {
    const out = summarizeBoards({
      boards: BOARDS, members: [], tasks: [], people: PEOPLE, viewerUserId: "u-erykah",
    });
    expect(out.map((b) => b.id).sort()).toEqual(["b-ops", "b-quiet"]);
  });

  it("resolves the owner to a name and email", () => {
    const out = summarizeBoards({
      boards: BOARDS, members: [], tasks: [], people: PEOPLE, viewerUserId: null,
    });
    const ops = out.find((b) => b.id === "b-ops")!;
    expect(ops.owner.email).toBe("jared@eklean.com");
    expect(ops.owner.name).toBe("Jared");
  });

  it("excludes the owner from the member list so they are not double-counted", () => {
    const members: MemberRow[] = [
      { project_id: "b-ops", user_id: "u-jared", role: "owner" },
      { project_id: "b-ops", user_id: "u-bryan", role: "member" },
    ];
    const ops = summarizeBoards({
      boards: BOARDS, members, tasks: [], people: PEOPLE, viewerUserId: null,
    }).find((b) => b.id === "b-ops")!;
    expect(ops.memberCount).toBe(1);
    expect(ops.members.map((m) => m.email)).toEqual(["bryan@eklean.com"]);
  });

  it("counts archived tasks separately from open — they are hidden on the board", () => {
    const tasks: TaskRow[] = [
      { project_id: "b-ops", is_done: false, archived: false },
      { project_id: "b-ops", is_done: false, archived: false },
      { project_id: "b-ops", is_done: true, archived: false },
      { project_id: "b-ops", is_done: false, archived: true },
    ];
    const ops = summarizeBoards({
      boards: BOARDS, members: [], tasks, people: PEOPLE, viewerUserId: null,
    }).find((b) => b.id === "b-ops")!;
    expect(ops.openTasks).toBe(2);
    expect(ops.doneTasks).toBe(1);
    expect(ops.archivedTasks).toBe(1);
  });

  it("treats a done+archived task as archived only, never counted twice", () => {
    const tasks: TaskRow[] = [{ project_id: "b-ops", is_done: true, archived: true }];
    const ops = summarizeBoards({
      boards: BOARDS, members: [], tasks, people: PEOPLE, viewerUserId: null,
    }).find((b) => b.id === "b-ops")!;
    expect(ops.doneTasks).toBe(0);
    expect(ops.archivedTasks).toBe(1);
    expect(ops.openTasks).toBe(0);
  });

  it("sorts busiest first, then alphabetically", () => {
    const tasks: TaskRow[] = [{ project_id: "b-quiet", is_done: false, archived: false }];
    const out = summarizeBoards({
      boards: BOARDS, members: [], tasks, people: PEOPLE, viewerUserId: null,
    });
    expect(out.map((b) => b.name)).toEqual(["Quiet", "Ops"]);
  });

  it("flags viewerHasAccess for a board the viewer owns", () => {
    const out = summarizeBoards({
      boards: BOARDS, members: [], tasks: [], people: PEOPLE, viewerUserId: "u-jared",
    });
    expect(out.find((b) => b.id === "b-ops")!.viewerHasAccess).toBe(true);
    expect(out.find((b) => b.id === "b-quiet")!.viewerHasAccess).toBe(false);
  });

  it("flags viewerHasAccess for a board the viewer is a member of", () => {
    const members: MemberRow[] = [
      { project_id: "b-quiet", user_id: "u-erykah", role: "member" },
    ];
    const out = summarizeBoards({
      boards: BOARDS, members, tasks: [], people: PEOPLE, viewerUserId: "u-erykah",
    });
    expect(out.find((b) => b.id === "b-quiet")!.viewerHasAccess).toBe(true);
    // Listing a board is NOT the same as being able to open it. The overview is
    // read-only; opening still goes through RLS, so the page must be able to
    // tell these apart or it will send her to a board that fails to load.
    expect(out.find((b) => b.id === "b-ops")!.viewerHasAccess).toBe(false);
  });

  it("never claims access when there is no signed-in viewer", () => {
    const out = summarizeBoards({
      boards: BOARDS, members: [], tasks: [], people: PEOPLE, viewerUserId: null,
    });
    expect(out.every((b) => !b.viewerHasAccess)).toBe(true);
  });

  it("survives an owner or member with no profile row", () => {
    const orphan: BoardRow[] = [
      { id: "b-x", name: "Orphan", slug: null, created_at: null, owner_user_id: "u-gone" },
    ];
    const members: MemberRow[] = [{ project_id: "b-x", user_id: "u-also-gone", role: null }];
    const out = summarizeBoards({
      boards: orphan, members, tasks: [], people: PEOPLE, viewerUserId: null,
    });
    expect(out[0].owner.email).toBeNull();
    expect(out[0].members[0].role).toBe("member");
  });

  it("returns an empty list when there are no boards", () => {
    expect(
      summarizeBoards({ boards: [], members: [], tasks: [], people: PEOPLE, viewerUserId: "u-erykah" }),
    ).toEqual([]);
  });
});
