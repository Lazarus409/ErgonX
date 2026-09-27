# Development-only demo credentials

Institution: `CSA-DEMO`
All addresses use `@csa.test`.

The seed command assigns its development password only when it creates a new
demo account. Use the command's `--password` option when initializing a fresh
demo database. Do not use these synthetic accounts or credentials in
production.

The default CSA-DEMO password is `ErgonxDemo!2026` for all personas below.
For an existing development database, run the reset command below to apply it.

For a previously seeded development database, use
`python manage.py seed_ergonx_demo --reset-passwords` to reset only the
synthetic CSA-DEMO users to the command's `--password` value.

Key personas:

- `kwame.mensah@csa.test` ? Institution Admin
- `ama.owusu@csa.test` ? HR Admin
- `abena.asare@csa.test` ? Recruitment Officer
- `yaw.osei@csa.test` ? Finance Manager
- `akosua.acheampong@csa.test` ? Accountant
- `kojo.addo@csa.test` ? Payroll Officer
- `efua.agyeman@csa.test` ? Department Head
- `nana.nyarko@csa.test` ? Employee self-service
- `sandra.appiah@csa.test` ? Auditor
- `evelyn.darko@csa.test` ? Director
