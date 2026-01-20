import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { users } from "../shared/schema";

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@curalina.com";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error("ADMIN_PASSWORD environment variable is required");
    process.exit(1);
  }

  console.log(`Upserting admin user for email: ${email}`);

  const db = getDb();
  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await db.select().from(users).where(eq(users.email, email));

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ password: hashedPassword, role: "admin" })
      .where(eq(users.email, email));
    console.log("Updated existing user to admin with new password.");
  } else {
    await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });
    console.log("Created new admin user.");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Error creating admin user:", err);
  process.exit(1);
});
