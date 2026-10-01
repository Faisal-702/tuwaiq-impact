import { db, purgeDemo } from "./demo-lib";

const sql = db();
purgeDemo(sql)
  .then((r) => console.log(`Removed ${r.projects} demo projects and ${r.students} demo students.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
