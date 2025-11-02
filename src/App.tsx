import { useState } from "react";
import { Chessboard } from "react-chessboard";
import type { ChessboardOptions, PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { useId } from "react";
import { useEffect, useRef } from "react";
import "./App.css";
import StockfishWorker from "./engine/stockfish.js?worker";

function App() {
  const [game, setGame] = useState(new Chess());
  const [historial, setHistorial] = useState<string[]>([]);
  const postTextAreaId = useId();
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const [evaluacion, setEvaluacion] = useState<string>("—");
  const engineRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (contenedorRef.current) {
      contenedorRef.current.scrollTop = contenedorRef.current.scrollHeight;
    }
  }, [historial]);

  useEffect(() => {
    const engine = new StockfishWorker();
    engineRef.current = engine;

    engine.onmessage = (event) => {
      const line = event.data;
      console.log("Stockfish:", line);

      if (line.startsWith("info depth")) {
        const match = line.match(/score (cp|mate) (-?\d+)/);
        if (match) {
          const turno = game.turn(); // 'w' o 'b'

          if (match[1] === "cp") {
            let cp = parseInt(match[2], 10);

            // 🔁 Invertir el signo si le toca al negro
            if (turno === "b") cp = -cp;

            const score = (cp / 100).toFixed(2);
            setEvaluacion(`${cp >= 0 ? "+" : ""}${score}`);
          } else if (match[1] === "mate") {
            const mate = parseInt(match[2], 10);
            // Si le toca al negro, invertimos el signo del mate también
            setEvaluacion(
              turno === "b" ? `Mate en ${-mate}` : `Mate en ${mate}`
            );
          }
        }
      }
    };

    // Inicializar el motor
    engine.postMessage("uci");
    engine.postMessage("isready");

    // Analizar la posición actual
    engine.postMessage(`position fen ${game.fen()}`);
    engine.postMessage("go depth 15");

    return () => engine.terminate();
  }, [game.fen()]);

  // Analizar la posición después de cada jugada
  useEffect(() => {
    if (engineRef.current) {
      const fen = game.fen();
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage("go depth 15");
    }
  }, [game]);

  const movimiento = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare) {
      return false;
    }

    const newGame = new Chess(game.fen());
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

    setHistorial((prev) => [...prev, jugada.san]);

    setGame(newGame);

    return true;
  };

  const chessboardOptions: ChessboardOptions = {
    position: game.fen(),
    onPieceDrop: movimiento,
  };

  return (
    <div className="app">
      <div className="contenedor_tablero">
        <Chessboard options={chessboardOptions} />
      </div>

      <div className="indicador" ref={contenedorRef}>
        <h3>
          Evaluación:&nbsp;
          <span
            className={evaluacion.startsWith("-") ? "negativo" : "positivo"}
          >
            {evaluacion}
          </span>
        </h3>
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
        rows={4}
        cols={40}
        className="output"
      />
    </div>
  );
}

export default App;
