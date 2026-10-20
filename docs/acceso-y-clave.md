# Portada y clave de acceso

## Qué hace la clave

No es una cortina. La clave deriva una llave con **PBKDF2-SHA256** (250.000
iteraciones, sal aleatoria de 16 bytes) y con ella se cifra el contenido del
panel con **AES-GCM de 256 bits** antes de guardarlo en el navegador.

Sin la clave, lo que queda almacenado es ilegible. No aparecen nombres, sueldos,
evaluaciones ni sanciones: solo el bloque cifrado.

```
{"v":1,"iv":"dStfK9oBiER4BDnJ","d":"20JpUPzhSkYPtMfKxKzXv9NZRoLRLBurNT…"}
```

## No hay recuperación

Es la contracara de que el cifrado sea real: **si se pierde la clave, se pierden
los datos**. No hay pregunta secreta ni restablecimiento, porque cualquiera de
las dos cosas sería una puerta trasera.

La única salida es borrar el contenido y empezar de nuevo, que es lo que ofrece
el enlace *Olvidé la clave*. Por eso conviene exportar un respaldo cada tanto
desde Configuración.

> El respaldo exportado se guarda **sin cifrar**, para que se pueda volver a
> importar desde cualquier equipo. Guardalo donde corresponda.

## Los tres estados de la portada

| Estado | Cuándo aparece |
|---|---|
| **Creá tu clave de acceso** | Primera vez que se abre el panel en esa computadora |
| **Ingresá tu clave** | Ya hay contenido protegido |
| **Panel listo para trabajar** | Se eligió trabajar sin clave; ofrece entrar o proteger con una clave |

Quien empezó sin clave puede ponerla después: el contenido que estaba en claro
se migra cifrado en ese momento, sin perder nada.

La migración distingue el contenido en claro del cifrado por su forma, no por si
el descifrado falla: solo se acepta como claro lo que tiene la estructura del
tablero. Una clave incorrecta nunca pisa datos recuperables.

El botón **Bloquear** del encabezado cierra el panel y vuelve a pedir la clave.

## Qué protege y qué no

Protege el contenido guardado en el navegador. Si alguien abre el archivo o el
navegador de esa computadora, sin la clave no lee nada.

No protege contra alguien que ya tenga control de la computadora mientras el
panel está abierto, ni reemplaza a las medidas de seguridad del equipo. Para
datos de personal, la clave del panel se suma al disco cifrado y a la sesión
bloqueada del sistema operativo; no los sustituye.

## Por qué no hay tipografía web

El panel tiene que poder abrirse desde el disco y sin internet. Una tipografía
cargada desde un servidor remoto fallaría en silencio y la página se vería con
otra fuente. Toda la personalidad tipográfica se resuelve con el stack del
sistema, la escala y los pesos.
