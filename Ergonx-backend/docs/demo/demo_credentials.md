# Development-only demo credentials

Institution: `APEX-DEMO`  
All addresses use `@apexdemo.example`.

The seed command assigns its development password only when it creates a new
demo account. Use the command's `--password` option when initializing a fresh
demo database. Do not use these synthetic accounts or credentials in
production.

The default APEX-DEMO password is `ErgonxDemo!2026` for all personas below.
For an existing development database, run the reset command below to apply it.

For a previously seeded development database, use
`python manage.py seed_ergonx_demo --reset-passwords` to reset only the
synthetic APEX-DEMO users to the command's `--password` value.

Key personas:

- `kwame.mensah@apexdemo.example` ? Institution Admin
- `ama.owusu@apexdemo.example` ? HR Admin
- `abena.asare@apexdemo.example` ? Recruitment Officer
- `yaw.osei@apexdemo.example` ? Finance Manager
- `akosua.acheampong@apexdemo.example` ? Accountant
- `kojo.addo@apexdemo.example` ? Payroll Officer
- `efua.agyeman@apexdemo.example` ? Department Head
- `nana.nyarko@apexdemo.example` ? Employee self-service
- `sandra.appiah@apexdemo.example` ? Auditor
- `evelyn.darko@apexdemo.example` ? Director
