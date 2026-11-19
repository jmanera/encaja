# Encaja

Juego de piezas que caen para tablet Android: mueve y gira las piezas de cuatro cuadros para que
encajen y completa filas. Es una página web (`app/assets/`) envuelta en una app Android mínima con un
WebView a pantalla completa. Funciona sin conexión.

## Descargar

La última versión firmada está en [Releases](https://github.com/jmanera/encaja/releases/latest): descarga `Encaja.apk` y ábrelo
en la tablet (la primera vez hay que permitir instalar aplicaciones de origen desconocido), o
instálalo con `adb install -r Encaja.apk`.

## Qué incluye

- Tablero de 10 columnas por 22 filas, las siete piezas de cuatro cuadros, sorteo por bolsas de siete
  (salen las siete antes de repetir), pieza guardada y las cinco siguientes a la vista.
- Giros a izquierda, derecha y media vuelta, con desplazamientos automáticos cuando la pieza choca
  con la pared o con otras piezas, y medio segundo de margen antes de que se fije (hasta 15 reinicios).
- Puntuación con giros especiales de la Te (y minigiros), rachas (+50 %), combos, bonus por dejar el
  tablero vacío y puntos por bajar y soltar.
- Seis modos: **Maratón** (150 líneas), **Sin fin**, **Sprint** (40 líneas contra el reloj),
  **Contrarreloj** (2 minutos), **Reto del día** (3 minutos con las mismas piezas para todos ese día)
  y **Zen** (sin perder nunca).
- Cuatro temas, cada pieza dibujada como una sola forma continua:
  - **Caramelos**: caramelos brillantes.
  - **Madera**: madera pintada con vetas y nudos.
  - **Neón**: contornos de luz.
  - **Navidad**: regalos con nieve encima y copos cayendo.
- Marcas de aterrizaje en el fondo (se pueden quitar), confeti al completar filas, polvo al encajar y
  las piezas se derrumban al perder.
- Tres melodías originales sintetizadas (una por tipo de modo) que se aceleran al subir de nivel, y
  efectos de sonido propios.
- Controles: gestos sobre el tablero (arrastrar, tocar, deslizar rápido abajo o arriba), botones en
  pantalla opcionales y teclado. Velocidad de repetición lateral ajustable.
- Récords por modo (los 5 mejores; en Sprint, los mejores tiempos), y la partida se guarda al salir
  para seguirla después.

## Diseño propio

Las reglas de este tipo de juego no están protegidas, pero la forma de presentarlo sí puede estarlo.
Por eso Encaja tiene su propio aspecto: tablero de 22 filas, piezas como formas continuas sin juntas,
colores propios en cada tema, marcas de aterrizaje en el fondo en lugar de una copia transparente de
la pieza, efectos propios al borrar filas y al perder, nombres propios para las jugadas y música
original.

## Añadir un tema

Cada tema es un fichero en `app/assets/temas/` que se añade a `index.html` con un `<script>` antes
de `dibujo.js`. Por ejemplo, `temas/playa.js`:

```js
(window.ENTemas = window.ENTemas || []).push({
  id: 'playa',
  nombre: 'Playa',
  descripcion: 'Piezas de arena y conchas',
  estilo: 'caramelo',          // caramelo | madera | neon | regalo
  colores: { fondo: '#0b2a3a', tablero: '#12394d', rejilla: 'rgba(255,255,255,.1)', borde: '#f4d58d',
             marca: '#ffffff', texto: '#ffffff', acento: '#f4d58d', panel: '#0f3243' },
  piezas: { I: '#f4a261', O: '#2a9d8f', T: '#e9c46a', S: '#e76f51', Z: '#8ecae6', J: '#ffb4a2', L: '#90be6d' },
  confeti: ['#ffffff', '#f4d58d', '#8ecae6'],
  particulas: null,            // null | 'nieve' | 'chispas'
  tablero(ctx, ancho, alto, casilla) { /* opcional: pintar el fondo del tablero */ },
});
```

Un estilo nuevo de pieza se añade en `dibujo.js` (objeto `STYLES`): recibe el contexto, el tema, el
color y las casillas de la pieza, y usa `shapePath` para dibujar la silueta continua.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `app/assets/motor.js` | Reglas del juego (sin DOM, se prueba con Node). |
| `app/assets/temas/*.js` | Temas: colores, estilo de pieza y partículas. |
| `app/assets/dibujo.js` | Dibujo en canvas de piezas, tablero, marcas y partículas. |
| `app/assets/musica.js` | Música original sintetizada. |
| `app/assets/app.js` | Bucle, controles, menús, sonido, récords y partida guardada. |
| `app/src/.../MainActivity.java` | Envoltorio Android (WebView). |
| `tools/test.js` | Pruebas del motor y partidas jugadas por un bot. |

## Compilar e instalar desde el código

Con la tablet conectada por USB y la depuración USB activada:

```bash
./build.sh
adb install -r Encaja.apk
```

`build.sh` pasa primero las pruebas y compila sin Gradle (usa `aapt2`, `javac`, `d8` y `apksigner`
del SDK en `~/Android/Sdk`). La primera vez crea `release.keystore` (no se sube al repo): guárdalo,
porque para actualizar la app sin desinstalarla hay que firmar siempre con la misma clave.

## Probar en el ordenador

```bash
python3 -m http.server 8770 -d app/assets
```

Y abrir `http://localhost:8770`.

## Publicar una versión

El workflow [Publicar APK](.github/workflows/release.yml) compila el APK firmado y crea una release
nueva (`v1.N`). Solo se lanza a mano, desde *Actions > Publicar APK > Run workflow*, y solo lo puede
ejecutar el dueño del repositorio. Firma con la misma clave que `release.keystore`, guardada en el
secreto `KEYSTORE_BASE64` (el fichero en base64):

```bash
base64 -w0 release.keystore | gh secret set KEYSTORE_BASE64
```

## Otros juegos

Hechos de la misma forma, para la misma tablet:

- [Mahjong solitario](https://github.com/jmanera/mahjong-solitario): emparejar fichas, con 12 tableros.
- [Autodefinidos](https://github.com/jmanera/autodefinidos): crucigramas con las definiciones dentro de la cuadrícula.
- [Sopa de letras](https://github.com/jmanera/sopa-de-letras): sopas de letras por temas.
- [Abecedario](https://github.com/jmanera/abecedario): una definición por letra contra el reloj, para uno o varios jugadores.
- [Zampabolas](https://github.com/jmanera/zampabolas): laberinto con bolitas, perseguidores y mundos temáticos.
