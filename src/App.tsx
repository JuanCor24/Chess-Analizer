import { useState } from "react";
import { Chessboard } from "react-chessboard";
import type { ChessboardOptions, PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { useId } from "react";
import { useEffect, useRef, useMemo } from "react";
import "./App.css";

import StockfishWorker from "./engine/stockfish.js?worker";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { faSquareCaretLeft } from "@fortawesome/free-solid-svg-icons";
import { faSquareCaretRight } from "@fortawesome/free-solid-svg-icons";
import { faLightbulb } from "@fortawesome/free-solid-svg-icons";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import { library } from "@fortawesome/fontawesome-svg-core"; /* son valores ejecutables en tiempo de ejecucion */

library.add(fas); /* se ejecuta cuando el codigo corre */

function App() {
  const [game, setGame] = useState(new Chess());
  const [historial, setHistorial] = useState<string[]>([]);
  const postTextAreaId = useId();
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const [evaluacion, setEvaluacion] = useState<string>("—");
  const engineRef = useRef<Worker | null>(null);
  const [puedeMover, setPuedeMover] = useState(true);
  const [cargando, setCargando] = useState(false);

  const [outputText, setOutputText] = useState(
    "Pulsa el boton verde para recibir una retroalimentacion de la jugada que acabas de hacer"
  );
  const [currentIndex, setCurrentIndex] = useState(historial.length);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const obtenerMejorJugada = (fen: string): Promise<string> => {
    return new Promise((resolve) => {
      const engine = engineRef.current;
      if (!engine) return resolve("VACÍA");

      const handleMessage = (event: MessageEvent) => {
        const line = event.data;
        if (line.startsWith("bestmove")) {
          const move = line.split(" ")[1];
          engine.removeEventListener("message", handleMessage); // removemos listener
          resolve(move);
        }
      };

      engine.addEventListener("message", handleMessage);

      engine.postMessage("uci");
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage("go depth 15");
    });
  };

  const handleIdea = async () => {
    setCargando(true);
    setOutputText("⌛ Analizando la posición… por favor espera.");
    const jugadaStockfish = await obtenerMejorJugada(game.fen());

    try {
      const response = await fetch("http://localhost:5000/evaluar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posicion: game.fen(),
          jugada: historial[historial.length - 1] || "VACÍA",
          evaluacion: evaluacion || "VACÍA",
          historial: historial.length > 0 ? historial : "VACÍO",
          mejorJugada: jugadaStockfish || "VACÍA", //Primero el nombre para poner el backend y despues la variable usada en la funcion
        }),
      });

      const data = await response.json();
      setOutputText(data.mensaje);
    } catch (error: unknown) {
      console.error("Error en la IA:", error);

      if (typeof error === "object" && error !== null && "status" in error) {
        const e = error as { status: number; message?: string };
        if (e.status === 429) {
          setOutputText(
            "⚠️ Cuota diaria de la IA alcanzada. Intenta más tarde."
          );
        } else {
          setOutputText(
            `❌ Error al obtener la explicación de la IA: ${e.message}`
          );
        }
      } else {
        setOutputText(
          "❌ Error desconocido al obtener la explicación de la IA"
        );
      }
    }
  };

  const handlePost = () => {
    if (currentIndex + 1 <= historial.length) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleEliminar = () => {
    if (historial.length === 0) return;
    const nuevoGame = new Chess();
    const nuevoHistorial = historial.slice(0, -1);
    nuevoHistorial.forEach((mov) => nuevoGame.move(mov));

    setHistorial(nuevoHistorial);

    setCurrentIndex((prevIndex) => {
      return Math.min(prevIndex, nuevoHistorial.length);
    });

    setGame(nuevoGame);
  };

  interface BarraEvaluacionProps {
    evaluacion: string;
  }

  const BarraEvaluacion: React.FC<BarraEvaluacionProps> = ({ evaluacion }) => {
    const turno = game.turn();
    let porcentajeBlancas;

    if (evaluacion[0] == "M" && turno == "b") {
      porcentajeBlancas = -100;
    } else if (evaluacion[0] == "M" && turno == "w") {
      porcentajeBlancas = 100;
    } else {
      const valorNumerico = parseFloat(evaluacion.replace(".", ".").trim());
      porcentajeBlancas = Math.min(Math.max((valorNumerico + 10) * 5, 0), 100);
    }

    return (
      <div className="barra-evaluacion">
        <div
          className="blancas"
          style={{ height: `${porcentajeBlancas}%` }}
        ></div>
        <div
          className="negras"
          style={{ height: `${100 - porcentajeBlancas}%` }}
        ></div>
      </div>
    );
  };

  useEffect(() => {
    console.log(currentIndex);
    console.log(historial.length);
    setPuedeMover(currentIndex == historial.length || historial.length === 0);
  }, [currentIndex, historial.length]);

  useEffect(() => {
    if (contenedorRef.current) {
      contenedorRef.current.scrollTop = contenedorRef.current.scrollHeight;
    }
  }, [historial]);

  const gameToRender = useMemo(() => {
    const g = new Chess();
    historial.slice(0, currentIndex).forEach((mov) => g.move(mov));
    return g;
  }, [historial, currentIndex]);

  if (!engineRef.current) {
    engineRef.current = new StockfishWorker();
    engineRef.current.postMessage("uci");
  }

  const engine = engineRef.current;
  const fen = gameToRender.fen();

  engine.onmessage = (event) => {
    const line = event.data;
    console.log("Stockfish:", line);

    if (!line.startsWith("info")) return;

    const match = line.match(/score (cp|mate) (-?\d+)/);

    console.log("Evaluacion: ", match);

    if (!match) return;

    if (match[1] === "cp") {
      let cp = parseInt(match[2], 10);
      console.log("intencional", cp);
      if (gameToRender.turn() === "b") {
        cp = -cp;
      }

      setEvaluacion((cp / 100).toFixed(2));
    } else {
      setEvaluacion(`Mate en ${match[2]}`);
    }
  };

  engine.postMessage("stop");

  engine.postMessage(`position fen ${fen}`);

  engine.postMessage("go depth 12");

  useEffect(() => {
    if (engineRef.current) {
      const fen = game.fen();

      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage("go depth 12");
    }
  }, [game]);

  const movimiento = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare) {
      return false;
    }

    if (!puedeMover) {
      console.log(
        "⚠️ No puedes mover mientras estás viendo jugadas anteriores"
      );
      return false;
    }

    const newGame = new Chess();
    for (let i = 0; i < currentIndex; i++) {
      newGame.move(historial[i]);
    }

    const piece = newGame.get(sourceSquare as Square);
    const isPromotion =
      piece?.type === "p" &&
      (targetSquare[1] === "8" || targetSquare[1] === "1");

    const jugada = newGame.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: isPromotion ? "q" : undefined,
    });

    if (!jugada) {
      return false;
    }

    setHistorial((prev) => {
      const newHistorial = prev.slice(0, currentIndex);
      return [...newHistorial, jugada.san];
    });

    setCurrentIndex((prev) => currentIndex + 1); // nunca más allá del historial

    setGame(newGame);

    return true;
  };

  const chessboardOptions: ChessboardOptions = {
    position: gameToRender.fen(),
    onPieceDrop: movimiento,
  };

  return (
    <div className="app">
      <div className="contenedor_tablero">
        <Chessboard options={chessboardOptions} />
      </div>

      <div className="cuadroRegistroPartida" ref={contenedorRef}>
        <h3 style={{ textAlign: "center" }}>Registro de partida</h3>
        <table className="tablaajedrez">
          <thead>
            <tr>
              <th>#</th>
              <th>Blancas</th>
              <th>Negras</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(historial.length / 2) }).map(
              /* Para calcular cuantas filas se necesitan*/
              (_, i) => (
                <tr key={i}>
                  <td>{i + 1}.</td>
                  <td>{historial[i * 2] || ""}</td>
                  <td>{historial[i * 2 + 1] || ""}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <label htmlFor={postTextAreaId}></label>
      <textarea
        id={postTextAreaId}
        name="postContent"
        rows={10}
        cols={60}
        className="output"
        readOnly
        value={outputText}
      />

      <BarraEvaluacion evaluacion={evaluacion} />

      <div className="listadebotones">
        <button className="botonEliminar" onClick={handleEliminar}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <button className="botonNumero" onClick={handlePrev}>
          <FontAwesomeIcon icon={faSquareCaretLeft} />
        </button>
        <button className="botonNumerodos" onClick={handlePost}>
          <FontAwesomeIcon icon={faSquareCaretRight} />
        </button>
        <button
          className="botonIdea"
          onClick={handleIdea}
          disabled={currentIndex !== historial.length}
          style={{
            opacity: currentIndex === historial.length ? 1 : 0.4,
            cursor:
              currentIndex === historial.length ? "pointer" : "not-allowed",
          }}
        >
          <FontAwesomeIcon icon={faLightbulb} />
        </button>
      </div>
    </div>
  );
}

export default App;
