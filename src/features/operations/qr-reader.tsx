import { useEffect, useRef, useState } from "react";
import { Effect } from "effect";
import QrScanner from "qr-scanner";
import { Button } from "../../components/ui/button";

export function QrReader({ onCode }: { onCode: (code: string) => void }) {
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");

  function found(code: string) {
    setCamera(false);
    setError("");
    onCode(code);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setCamera(!camera)}>
          {camera ? "Cerrar cámara" : "Escanear QR con cámara"}
        </Button>
        <label className="text-sm font-bold" htmlFor="qr-image">
          O leer una imagen QR
        </label>
        <input
          id="qr-image"
          type="file"
          accept="image/*"
          className="max-w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file === undefined) return;
            setError("");
            Effect.runFork(
              Effect.tryPromise(() =>
                QrScanner.scanImage(file, { returnDetailedScanResult: true }),
              ).pipe(
                Effect.match({
                  onSuccess: (result) => found(result.data),
                  onFailure: () =>
                    setError(
                      "No pudimos leer el QR. Prueba con una imagen más nítida o escribe el código.",
                    ),
                }),
              ),
            );
            event.target.value = "";
          }}
        />
      </div>
      {camera && <Camera onCode={found} />}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Camera({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  // The camera and worker are external resources owned by this mounted view.
  useEffect(() => {
    if (video.current === null) return undefined;
    let active = true;

    const scanner = new QrScanner(
      video.current,
      (result) => {
        if (active) {
          scanner.stop();
          onCode(result.data);
        }
      },
      { preferredCamera: "environment", maxScansPerSecond: 5, returnDetailedScanResult: true },
    );

    Effect.runFork(
      Effect.tryPromise(() => scanner.start()).pipe(
        Effect.catch(() =>
          Effect.sync(() => {
            if (active)
              setError("No pudimos abrir la cámara. Revisa sus permisos o escribe el código.");
          }),
        ),
      ),
    );

    return () => {
      active = false;
      scanner.destroy();
    };
  }, [onCode]);

  return (
    <div className="max-w-md space-y-2">
      <video
        ref={video}
        muted
        playsInline
        aria-label="Cámara para leer el código QR"
        className="w-full rounded-lg bg-foreground"
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
