import { describe, it } from "vitest";
import { expectMatchesGolden } from "./snapshotHelper";

describe("Thumbnail snapshot", () => {
  it("the 9:16 cover matches the golden image", async () => {
    await expectMatchesGolden("Thumbnail", "thumbnail", "cover", 0);
  });
});
