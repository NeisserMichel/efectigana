# EfectiGana

Web y app (PWA instalable en Android/iPhone) de pozos semanales: los usuarios recargan saldo por Yape (vía WhatsApp), juegan en 4 pozos y cada **domingo a las 8:00 p.m. (hora de Lima)** se sortea automáticamente un ganador por pozo.

| Pozo | Precio por jugada |
|---|---|
| Bronce | S/ 0.50 |
| Plata | S/ 1.00 |
| Oro | S/ 3.00 |
| Diamante | S/ 5.00 |

## Funcionalidades
- Registro con correo, contraseña y celular (+51, 9 dígitos). Cada usuario recibe un ID tipo `EG-1001`.
- Montos recaudados, participantes y jugadas **en vivo** (Supabase Realtime) + cuenta regresiva.
- **Recargar**: el usuario elige o edita el monto, se crea una solicitud y se abre WhatsApp (+51 917 486 188) con el mensaje listo (ID, monto, celular, N° de solicitud, nombre de la app y pedido de autorización para yapear).
- **Jugar**: elige pozo y cantidad de jugadas; el saldo se descuenta automáticamente.
- **Sorteo automático**: 1 ganador por pozo, cada jugada = 1 boleto (número aleatorio criptográfico). El premio (90%) se suma automáticamente al saldo del ganador; 10% de comisión (configurable en la tabla `settings`). Si un pozo no tiene participantes, se cierra sin ganador.
- Historial de movimientos y solicitudes de recarga del usuario.
- **Panel de administrador** (`/admin`):
  - Aprobar/rechazar recargas (al aprobar se acredita el saldo).
  - Buscar usuarios, **descontar** monedas (recargas fraudulentas) o abonar, con motivo obligatorio; bloquear cuentas.
  - Ver pozos en curso, historial de sorteos, ganadores y comisiones.

Toda la lógica de dinero está en funciones de Postgres (`security definer`) con RLS: el navegador **no puede** modificar saldos directamente.

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto nuevo en tu cuenta de Supabase.
2. **Database → Extensions**: activa `pg_cron` (pgcrypto ya viene activa).
3. **SQL Editor** → pega y ejecuta todo `supabase/migrations/001_efectigana.sql`.
4. **Authentication → URL Configuration**: en *Site URL* pon la URL de tu web (ej. `https://efectigana.vercel.app`).
5. Regístrate en la web y conviértete en administrador ejecutando en SQL Editor:
   ```sql
   update public.profiles set is_admin = true where email = 'TU_CORREO@gmail.com';
   ```

### 2. Variables de entorno
Copia `.env.example` a `.env` y completa con *Project Settings → API*:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_WHATSAPP_NUMBER=51917486188
```

### 3. Ejecutar / publicar
```bash
npm install
npm run dev      # desarrollo
npm run build    # producción (carpeta dist/)
```
Para publicar: importa el repo en **Vercel** (o Netlify), agrega las 3 variables de entorno y despliega. `vercel.json` ya incluye las reglas de rutas.

### 4. App en el celular
La web es una PWA: en Android abre la web en Chrome → menú → **Instalar app**; en iPhone, Safari → Compartir → **Agregar a inicio**. Si luego quieres publicarla en Play Store, se puede empaquetar con Capacitor o TWA sin cambiar el código.

## Ajustes útiles (SQL)
```sql
update settings set value = '15' where key = 'commission_pct';   -- cambiar comisión
update settings set value = '500' where key = 'max_recharge';     -- tope por recarga
update pools set ticket_price = 2 where id = 2;                    -- cambiar precio de un pozo
```

## Estructura
```
supabase/migrations/001_efectigana.sql   Base de datos, seguridad, sorteo y cron
src/pages/AuthPage.tsx                   Ingreso y registro
src/pages/HomePage.tsx                   Saldo, cuenta regresiva, pozos en vivo, ganadores
src/pages/HistoryPage.tsx                Movimientos y solicitudes
src/pages/AdminPage.tsx                  Panel de administrador
src/components/RechargeModal.tsx         Recarga por Yape vía WhatsApp
src/components/BetModal.tsx              Jugar en un pozo
```
