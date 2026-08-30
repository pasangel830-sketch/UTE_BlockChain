# Informe de mejoras UI/API — UTE Blockchain

**Alcance:** identidad en pantalla, separación de roles en pagos, Explorer con detalle Fabric, usuarios B/C/D, docs.
**Restricción:** no borrar ledger desde la app, no reescribir chaincode salvo que una fase lo pida, no romper el flujo hito → custodia → evento → Explorer.
**Red diaria actual:** 3 orderers + peer A + peer Admin. B/C/D solo con `make up-full` / `make pdc-up`.

Dominio ya documentado en `docs/INFORME-PROGRESO.md`: A+C sobre de cimentación (`obra-gruesa-solar`); B+D quirófanos (`quirofanos-tech`); Administración = ayuntamiento.

---

## Qué no hay que hacer

- No hay endpoint ni botón “borrar hitos / poner avance a 0”. El ledger es append-only. Cero = `make reset-dev` + `make deploy-cc` + `make api-up` (red nueva), o crear hitos nuevos y Recalcular.
- No inventar “nodos validadores 0x…” ni claves tipo Ethereum. Orderers Raft ordenan; peers endosan.
- No cambiar políticas de `configtx.yaml`, collections ni versiones de chaincode en las fases 0–1.
- No quitar rutas, badges, polling 3 s, mock banco, ni el Explorer compacto en `/hitos`.
- `POST /pagos/:id/autorizar` debe seguir haciendo `submit(..., 'autorizarPago')` como `AdministracionMSP` y disparar el evento. Solo se añade el **quién puede llamarlo**.

Cambio de demo aceptado: **empresaA ya no autoriza pagos**. Flujo: A completa hito → Salir → `administracion` autoriza.

---

## Fase 0 — Identidad en UI (bajo riesgo)

**Problema:** JWT tiene `{ sub, org }` (`backend/src/auth.ts`) y solo se guarda el token (`frontend/src/lib/api.ts`). `Shell` no muestra usuario.

### 0.1 Perfiles (mapa fijo)

Nuevo `frontend/src/lib/orgs.ts` (no hardcodear el texto en cada página):

| `org` (JWT) | `username` | `label` | `oficio` | `lote` | `pct` |
|---|---|---|---|---|---|
| EmpresaAMSP | empresaA | Empresa A | Cimentación / obra gruesa | obra-gruesa-solar | 35 |
| EmpresaCMSP | empresaC | Empresa C | Cimentación / obra gruesa (socia A) | obra-gruesa-solar | 20 |
| EmpresaBMSP | empresaB | Empresa B | Quirófanos / instalaciones | quirofanos-tech | 25 |
| EmpresaDMSP | empresaD | Empresa D | Quirófanos / instalaciones (socia B) | quirofanos-tech | 20 |
| AdministracionMSP | administracion | Administración | Ayuntamiento — autoriza pagos | — | — |

Helper: `profileOf(org: string)`.

### 0.2 Leer sesión

En `frontend/src/lib/api.ts`:

- `decodeToken()`: payload JWT (split `.` + `atob` + `JSON.parse`). Sin nueva dependencia.
- `getSession(): { username: string; org: string } | null` usando `sub` y `org`.
- Opcional backend: `GET /auth/me` con `auth` → `{ username: req.user.sub, org: req.user.org }`. Si se añade, documentar en `backend/src/swagger.ts`. No sustituye el mapa de oficios.

### 0.3 Chip en `Shell`

`frontend/src/components/Shell.tsx`: a la izquierda del menú o entre título y nav:

`Empresa A · Cimentación (obra gruesa-solar) · 35 %`

Si es Admin: `Administración · Ayuntamiento · autoriza pagos`.

Si no hay token, el `useEffect` actual a `/` se mantiene.

**No tocar:** lista `LINKS`, `Salir`, `clearToken`.

### 0.4 Login

`frontend/src/app/page.tsx`: bajo el título, las 5 cuentas (aunque B/C/D no entren hasta fase 2):

`empresaA / empresaA` … `administracion / administracion`

Placeholder A se mantiene para no romper el hábito diario.

**Verificar:** login A → chip A; Salir; login Admin → chip Admin; recarga F5 conserva chip (token en localStorage).

---

## Fase 1 — Solo Administración autoriza (necesario, cambia UX)

**Problema:** `backend/src/routes.ts` ~206–219 ignora `req.user` y firma siempre como `AdministracionMSP`. `pagos/page.tsx` muestra Autorizar a cualquiera si `estado === 'CUSTODIA'`.

### 1.1 API

En `POST /pagos/:id/autorizar`, **antes** del `submit`:

```
if (req.user?.org !== 'AdministracionMSP') {
  res.status(403).json({ error: 'solo Administración autoriza pagos' });
  return;
}
```

No cambiar `submit('AdministracionMSP', ..., 'autorizarPago', ..., ENDORSE_DAILY)` ni `refreshEstado`.

Opcional misma guarda en `POST /pagos/:id/rechazar`.

**No tocar chaincode** `autorizarPago` (exigiría `make deploy-cc`). La guarda en API basta para la UI.

### 1.2 UI Pagos

`frontend/src/app/pagos/page.tsx`: Autorizar solo si `getSession()?.org === 'AdministracionMSP' && p.estado === 'CUSTODIA'`.

Si es empresa y hay CUSTODIA: texto tipo `Pendiente de Administración` (sin botón).

**Verificar:** A completa hito → pago CUSTODIA, sin Autorizar; Admin autoriza → `AUTORIZADO` + mock banco; A pulsa Autorizar (curl) → 403; Explorer sigue subiendo.

**Tests:** `network/scripts/verify-api.sh` y `verify-ui.sh` usan `empresaA`. Si autorizan como A, **actualizarlos** a login Admin para ese POST. Si no, CI/scripts locales rompen.

---

## Fase 1b — Recalcular al crear hito (mínimo)

`POST /hitos` en `routes.ts` no llama `refreshEstado`. Dashboard/Estado se quedan en % viejo hasta Completar o Recalcular.

Tras el `submit` de `crearHito`, `void refreshEstado(orgOf(req));` igual que en completar.

No hace falta cambiar `agregarEstado` (`backend/src/estado.ts`).

---

## Fase 2 — Explorer con detalle Fabric (aditivo)

**Hoy:** `backend/src/explorer.ts` guarda `{ number, txCount, receivedAt }`. `txCount` = `block.getData().getDataList().length`. UI: `ExplorerPanel.tsx`.

### 2.1 Backend — ampliar snapshot, no sustituir

Seguir escuchando `getBlockEvents`. Por cada bloque, **además**:

De `header`: `previousHash`, `dataHash` (hex).
Por cada envelope en `data.data`: `txId`, `timestamp` (channel header), `type`; `creatorMsp` (signature header / `SerializedIdentity`); si es endorser tx: `chaincode`, `fn` (primeros args de la propuesta; no volcar transients PDC); `endorsers: string[]` (MSP de cada endorsement).

Tipos (nombres orientativos):

```
ExplorerTx = { txId, fn?, chaincode?, creatorMsp?, endorsers?, timestamp? }
ExplorerBlock = { number, txCount, receivedAt, previousHash?, dataHash?, txs?: ExplorerTx[] }
```

`getExplorerSnapshot()` igual. Parseo **por tx con try/catch**: si un envelope falla, `txCount` y `number` siguen. Dependencia ya transitiva: `@hyperledger/fabric-protos` (via fabric-gateway 1.12.0). Importar proto `common` / `peer` / `msp`; no añadir Ethereum ni validators.

`receivedAt` = hora de recepción API (dejarlo). El timestamp de tx es el del header Fabric.

### 2.2 Frontend

`ExplorerPanel.tsx`:

- Compacto (`/hitos`): igual (altura + # + N tx + hora).
- Completo (`/explorer`): bloque clicable; dentro, lista de txs: `txId` (mono, truncar + copy), `chaincode.fn`, `creatorMsp`, `endorsers`, hashes del bloque.

Textos: “endosos (peers)”, “orderers Raft (no se listan por bloque)”. No “validador”.

**Verificar:** Completar hito (2 submits) → bloque 1 o 2 tx con `completarHito` / `ponerEnCustodia`; altura y polling intactos; API `GET /explorer` sigue 200 si el parseo parcial falla.

---

## Fase 3 — Usuarios B/C/D (más delicado; no romper diario)

**Hoy:** `OrgMsp` = `'EmpresaAMSP' | 'AdministracionMSP'` en `backend/src/config.ts`.
`AUTH_USERS` en config, `.env.example`, `network/docker-compose.api.yaml`.
`backend/src/fabric.ts` `ORG_DOMAIN` solo A y Admin. Gateway siempre a `PEER_ENDPOINT` = peer A.

Crypto de B/C/D **ya existe** (`cryptogen` genera las 5 orgs). Falta cablear login + identidad.

### 3.1 Auth

Ampliar `AUTH_USERS`:

`empresaA:empresaA:EmpresaAMSP,empresaB:empresaB:EmpresaBMSP,empresaC:empresaC:EmpresaCMSP,empresaD:empresaD:EmpresaDMSP,administracion:administracion:AdministracionMSP`

Mismo formato `user:pass:MSP`. Default en `config.ts` y compose API. JWT igual (`sub`, `org`).

`export type OrgMsp` = los 5 MSP.

### 3.2 Gateway

`ORG_DOMAIN`:

- EmpresaBMSP → `empresab.ute.local`
- EmpresaCMSP → `empresac.ute.local`
- EmpresaDMSP → `empresad.ute.local`

`connectOrg` ya arma `Admin@${domain}/msp`. TLS y `PEER_ENDPOINT` **seguir en peer A** en modo diario: B puede *evaluate* estado público contra peer A con cert B. No apuntar a peer B si no está caído el diario.

`submit` como B de `quirofanos-tech` fallará sin peer B: devolver 500 con el error de endorsement, no tumbar la API.

Opcional más adelante: si `org` es B/D y existe peer B, cambiar endpoint. Fuera de esta fase.

### 3.3 UI: empresa y lote según sesión

Hoy hardcode:

- `hitos/page.tsx` `empresa: 'EmpresaA'`
- `incidencias/page.tsx` `empresa: 'EmpresaA'`, `lote: 'obra-gruesa-solar'`

Usar perfil:

- `empresa` = EmpresaA/B/C/D según org (Admin no crea hitos de constructor; ocultar formulario o 403 en API).
- `lote` = `obra-gruesa-solar` (A/C) o `quirofanos-tech` (B/D).
- Crear incidencia con lote de otra colección: el chaincode ya lanza `MSP … no escribe en colección`. Mostrar el error.

**Diario:** solo A y Admin tienen peer. Login B/C/D puede listar hitos (evaluate vía peer A) y fallar al escribir PDC B. En login, nota: *B/C/D escritura PDC requiere `make pdc-up`*.

**No tocar:** `network/collections-config.json`, política pago `AND(A, Admin)`, `ENDORSE_DAILY`.

**Verificar:** `make up-dev` + login A y Admin como ahora. B login no rompe A. `verify-pdc.sh` (A lee PDC, Admin no) sigue.

---

## Fase 4 — Manual (docs, cero riesgo runtime)

Nuevo `docs/MANUAL.md` (no duplicar el checklist de 14 días). Contenido ya hablado:

- 7 pantallas y qué hacen
- usuarios/contraseñas
- estados hito / pago / incidencia
- avance = `hitosCompletados/hitosTotal*100` (`backend/src/estado.ts`)
- inmutabilidad vs `make reset-dev`
- Grafana `admin`/`changeme` :3001; Swagger `:4000/api-docs`

Enlace corto desde `README.md` (una línea). No reescribir `PLAN-14-DIAS.md`.

---

## Orden de implementación

1. Fase 0 (chip + `orgs.ts` + `getSession`)
2. Fase 1 (403 + ocultar Autorizar + scripts verify)
3. Fase 1b (`refreshEstado` al crear hito)
4. Fase 2 (Explorer)
5. Fase 3 (B/C/D)
6. Fase 4 (manual)

Tras cada fase: `make api-up` (el API corre `dist/`; hay que `npm run build`). Frontend con `make ui-up` recarga solo.

---

## Archivos previstos

| Archivo | Fases |
|---|---|
| `frontend/src/lib/orgs.ts` | 0 (nuevo) |
| `frontend/src/lib/api.ts` | 0 |
| `frontend/src/components/Shell.tsx` | 0 |
| `frontend/src/app/page.tsx` | 0, 3 |
| `frontend/src/app/pagos/page.tsx` | 1 |
| `frontend/src/app/hitos/page.tsx` | 3 |
| `frontend/src/app/incidencias/page.tsx` | 3 |
| `frontend/src/components/ExplorerPanel.tsx` | 2 |
| `backend/src/routes.ts` | 1, 1b, 0 opcional `/auth/me` |
| `backend/src/explorer.ts` | 2 |
| `backend/src/swagger.ts` | 0, 2 |
| `backend/src/config.ts` | 3 |
| `backend/src/fabric.ts` | 3 |
| `backend/.env.example` | 3 |
| `network/docker-compose.api.yaml` | 3 |
| `network/scripts/verify-api.sh` `verify-ui.sh` | 1 |
| `docs/MANUAL.md` | 4 (nuevo) |
| `README.md` | 4, una línea |

**No modificar (fases 0–2):** `chaincode/**`, `network/configtx.yaml`, compose Fabric, Grafana.

---

## Criterio de no-regresión

- Login `empresaA`/`empresaA` y `administracion`/`administracion` siguen.
- Crear → Iniciar → Validar → Completar → pago `CUSTODIA` (solo Admin autoriza).
- Evento `PagoAutorizado` → `POST /mock/banco/pagos`.
- Explorer: altura crece; compacto en hitos igual.
- A ve PDC `obra-gruesa-solar`; Admin no (`verify-pdc.sh`).
- Sin botón de borrar ledger.

---

## Demo post-cambio (defensa)

1. `empresaA` — chip cimentación. Crear y completar hito. Pago CUSTODIA, sin Autorizar. Explorer: txs con función y MSP.
2. Salir. `administracion` — chip ayuntamiento. Autorizar. Mock banco.
3. Incidencias como A: Ver PDC OK; como Admin: error.
4. (Si fase 3 + `pdc-up`) `empresaB` — chip quirófanos; incidencia `quirofanos-tech`.
