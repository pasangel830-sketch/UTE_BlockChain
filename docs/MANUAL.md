# Manual de uso — UTE Blockchain

Manual de la aplicación para la defensa. El estado de las tareas está en [CHECKLIST.md](CHECKLIST.md);
el marco técnico, en [PLAN-14-DIAS.md](PLAN-14-DIAS.md). Aquí solo se explica **cómo se usa**.

## 1. Arrancar

```bash
make up-dev     # 3 orderers Raft + peer Empresa A + peer Administración + canal
make deploy-cc  # solo si la red es nueva
make api-up     # API Express en :4000
make ui-up      # Next.js en :3000
```

Opcional: `make pdc-up` añade los peers de Empresa B, C y D (necesario para escribir datos privados
del lote `quirofanos-tech`), y `make monitoring-up` levanta Prometheus y Grafana.

Tras el cambio del 11 sep (`completarHito` → pago en el mismo tx) hace falta **`make deploy-cc`**
si la red ya estaba desplegada con la versión anterior.

| Servicio | URL | Credenciales |
| --- | --- | --- |
| Aplicación | http://localhost:3000 | ver tabla de usuarios |
| API + Swagger | http://localhost:4000/api-docs | JWT del login |
| Grafana | http://localhost:3001 | `admin` / `changeme` |
| Prometheus | http://localhost:9090 | — |

## 2. Usuarios

Contraseña = nombre de usuario. Cada usuario firma con el certificado de su organización (MSP), así
que la red distingue quién hace cada cosa, no solo la aplicación.

| Usuario | Contraseña | MSP | Papel | Lote (datos privados) | Participación |
| --- | --- | --- | --- | --- | --- |
| `empresaA` | `empresaA` | EmpresaAMSP | Constructora, cimentación / obra gruesa | `obra-gruesa-solar` | 35 % |
| `empresaB` | `empresaB` | EmpresaBMSP | Constructora, quirófanos / instalaciones | `quirofanos-tech` | 25 % |
| `empresaC` | `empresaC` | EmpresaCMSP | Constructora, socia de A | `obra-gruesa-solar` | 20 % |
| `empresaD` | `empresaD` | EmpresaDMSP | Constructora, socia de B | `quirofanos-tech` | 20 % |
| `administracion` | `administracion` | AdministracionMSP | Ayuntamiento: autoriza o rechaza pagos | ninguno | — |

La sesión dura 8 horas. El chip de la cabecera muestra siempre con quién estás dentro.

### Qué puede hacer cada uno

- **Constructoras (A, B, C, D):** crear hitos, avanzarlos, abrir incidencias de su lote y leer el
  detalle privado de su lote. Tratan o cierran **solo las incidencias que abrieron ellas**. No
  pueden autorizar ni rechazar pagos.
- **Administración:** ver todo lo público, autorizar o rechazar pagos. No registra ni avanza obra
  propia, no abre ni tramita incidencias de lote, y **no puede leer** el detalle privado de ninguna
  colección: su nodo solo guarda el hash.

### Nodos y red diaria

`make up-dev` arranca únicamente el nodo de Empresa A y el de Administración. B, C y D **entran y
consultan igual** (sus consultas salen por el nodo de A firmadas con su propio certificado), pero
escribir en la colección privada `quirofanos-tech` exige un nodo de B o de D: hace falta
`make pdc-up`. La aplicación lo avisa antes de que ocurra y, si ocurre, lo explica en pantalla.

## 3. Las siete pantallas

| # | Ruta | Qué hace |
| --- | --- | --- |
| 1 | `/` | Login. Lista las cinco cuentas y avisa del alcance de la red diaria. |
| 2 | `/dashboard` | Resumen: avance, hitos, pagos en custodia e incidencias abiertas. |
| 3 | `/hitos` | Alta de hitos y máquina de estados, con los pagos asociados y el Explorer compacto al lado. |
| 4 | `/pagos` | Escrow: pagos en custodia, desglose por participación; Autorizar y Rechazar (solo Administración). |
| 5 | `/incidencias` | Incidencias públicas del canal, empresa y lote, y botón **Ver PDC** para el detalle privado. |
| 6 | `/estado` | Estado de obra agregado y botón **Recalcular**. |
| 7 | `/explorer` | Bloques del canal: altura, hashes, transacciones, función invocada y MSP endosantes. |

### Hitos

Crear un hito lo registra a nombre de la constructora de la sesión (el body no elige empresa). El
botón que aparece es siempre el único movimiento válido desde el estado actual. Administración no
ve esos botones: no da de alta ni avanza obra.

```
PENDIENTE → EN_EJECUCION → VALIDACION → COMPLETADO
                              └────────→ RECHAZADO
```

Completar un hito (solo en `VALIDACION`) exige un acta PDF o foto. El archivo queda en disco; el
SHA-256 se escribe en `hashEvidencia` del hito **en la misma transacción** que marca `COMPLETADO` y
crea el pago en `CUSTODIA`. En el Explorer se ve `completarHito` con el hash en los argumentos.

### Pagos (escrow)

```
CUSTODIA → AUTORIZADO
        └→ RECHAZADO
```

El dinero queda retenido hasta que el ayuntamiento lo libera o lo anula. La constructora ve
*«En custodia — pendiente de autorización de Administración»*, sin botón: no es un error, es el
circuito. Administración ve **Autorizar** y **Rechazar**. Cuando autoriza, el chaincode emite el
evento `PagoAutorizado`, el backend lo escucha y llama al banco simulado (`POST /mock/banco/pagos`).
Rechazar no dispara ese evento.

El importe se reparte por participación: A 35 %, B 25 %, C 20 %, D 20 %. El desglose se calcula en el
chaincode y se guarda en el pago.

### Incidencias y datos privados (PDC)

```
ABIERTA → EN_TRATAMIENTO → CERRADA
   └──────────────────────→ RECHAZADA
```

Lo público (título, empresa, lote, estado) va al canal y lo ve todo el mundo. El alta fija `empresa`
y `lote` según la sesión; otra constructora no puede tratar, cerrar ni rechazar una incidencia que
no abrió ella (403). El detalle sensible (coste estimado, notas técnicas) va a la colección privada
del lote:

| Colección | Socios |
| --- | --- |
| `obra-gruesa-solar` | Empresa A y Empresa C |
| `quirofanos-tech` | Empresa B y Empresa D |

**Ver PDC** como socio devuelve el detalle. Como no socio devuelve un rechazo de la red explicando
que ese nodo solo almacena el hash que prueba que el dato existe y que no ha cambiado. Es la
demostración de la confidencialidad: el hash está en el canal, el contenido no.

Las **evidencias** (foto o PDF, máx. 5 MB) se pueden adjuntar al crear o después, mientras la
incidencia esté `ABIERTA` o `EN_TRATAMIENTO`, y **solo quien la abrió**. El archivo queda en disco
local (`uploads/`); **no entra en Fabric**. El hash SHA-256 se muestra en la ficha y, al crear, se
escribe en `notasTecnicas` del PDC (`hashEvidencia …`). Listar y descargar: solo socios del lote.
Administración no ve las fotos. Fixtures de demo (no se suben al repo): `ficheros_evidencias_test/`.

Las listas de hitos, pagos, incidencias y evidencias salen de **más reciente a más antiguo**, con
fecha y hora.

### Estado de obra

Lo calcula el backend leyendo hitos, pagos e incidencias, y lo escribe en `EstadoObraContract`
(sin llamadas entre chaincodes). Se refresca al crear y al completar hitos, y con **Recalcular**.

```
avancePct = redondear(hitosCompletados / hitosTotal * 100)
```

Con 0 hitos el avance es 0. Los hitos rechazados cuentan en el total pero no como completados.

### Explorer

Muestra los bloques según llegan (polling cada 3 s). De cada bloque: número, hora, `previousHash` y
`dataHash`; de cada transacción: `txId`, chaincode y función, MSP creador y MSP endosantes. Los
orderers Raft ordenan los bloques y no aparecen por bloque; quienes firman son los peers endosantes.

## 4. Cuando algo se rechaza

Todos los errores distinguen dos cosas que en Fabric se parecen mucho:

- **Rechazo por regla de negocio** (ámbar): la red funcionó y dijo que no. Por ejemplo, escribir en un
  lote del que no eres socio. Lleva la nota *«Comportamiento esperado: aislamiento de datos privados»*.
- **Indisponibilidad de infraestructura** (rojo): la operación es legítima pero ahora no se puede.
  Por ejemplo, el nodo del socio está apagado. Siempre termina con el comando que lo arregla.

En ambos casos el mensaje crudo de Fabric (`rpc error: code = ...`) está disponible en el desplegable
**Detalle técnico**: la pantalla explica, no oculta.

## 5. Inmutabilidad

El registro es *append-only*. **No hay ningún botón para borrar hitos ni para poner el avance a 0**, y
no lo habrá: sería exactamente lo contrario de lo que demuestra el proyecto. Intentar reutilizar un
identificador ya usado devuelve *«Ya existe un hito con el identificador …: el registro es inmutable»*.

Para empezar de cero solo hay dos caminos honestos:

1. **Red nueva**: `make reset-demo-dev` (portátil) o `make reset-demo-full` (tribunal, 5 peers).
   Baja la API antes de tocar el ledger (si no, el Explorer conserva txs en RAM). Borra volúmenes,
   bloques y evidencias; redespliega chaincode y levanta la API. Es una cadena distinta, no un ledger editado.
2. **Seguir hacia delante**: crear hitos nuevos y pulsar **Recalcular**.

## 6. Guion de demostración

1. Entrar como `empresaA`. El chip muestra *Empresa A · Cimentación (obra-gruesa-solar) · 35 %*.
2. Crear un hito y llevarlo hasta **Completar**. En `VALIDACION` hay que adjuntar PDF o foto; sin
   archivo el botón no arranca. Aparece el pago en `CUSTODIA` y el hash del acta en la ficha.
3. Mirar el Explorer: el bloque nuevo trae `completarHito` (hito, hash y pago en el mismo tx).
4. **Salir** y entrar como `administracion`. En pagos CUSTODIA aparecen Autorizar y Rechazar.
   Autorizar; comprobar el webhook en `GET /mock/banco/pagos`.
5. Incidencias como `empresaA`: adjuntar foto o PDF; **Ver PDC** muestra el hash; Tratar/Cerrar solo en las suyas.
   Como `administracion`: sin trámite, rechazo al leer PDC y al listar evidencias.
6. (Con `make pdc-up`) Entrar como `empresaB` y crear una incidencia de `quirofanos-tech`; leer su PDC y evidencias.
   Como `empresaA` esa incidencia no muestra Tratar/Cerrar ni las fotos. Sin `pdc-up`, la misma acción muestra el
   aviso rojo con `make pdc-up`, que es el punto a explicar.
