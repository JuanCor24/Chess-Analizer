import { useState } from "react";
import { Chessboard } from "react-chessboard";
import type { ChessboardOptions, PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { useId } from "react";
import { useEffect, useRef } from "react";
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

  const [outputText, setOutputText] = useState(
    "Pulsa el boton verde para recibir una retroalimentacion de la jugada que acabas de hacer"
  );
  const [currentIndex, setCurrentIndex] = useState(historial.length);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
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

  const handleIdea = async () => {};

  interface BarraEvaluacionProps {
    evaluacion: string;
  }

  const BarraEvaluacion: React.FC<BarraEvaluacionProps> = ({ evaluacion }) => {
    const turno = game.turn();
    let porcentajeBlancas;

    console.log("Valor de evaluación:", turno);

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

  useEffect(() => {
    const engine = new StockfishWorker();
    engineRef.current = engine;

    engine.onmessage = (event) => {
      const line = event.data;
      console.log("Stockfish:", line);

      if (line.startsWith("info depth")) {
        const match = line.match(/score (cp|mate) (-?\d+)/);
        if (match) {
          if (match[1] === "cp") {
            let cp = parseInt(match[2], 10);
            const turno = gameToRender.turn();
            if (turno === "b") cp = -cp;

            const score = (cp / 100).toFixed(2);
            setEvaluacion(`${cp >= 0 ? "+" : ""}${score}`);
          } else if (match[1] === "mate") {
            const mate = parseInt(match[2], 10);

            setEvaluacion(`Mate en ${mate}`);
          }
        }
      }
    };
    engine.postMessage(`position fen ${gameToRender.fen()}`); //gameToRender es la posicion actual del indice
    engine.postMessage("go depth 100");

    return () => engine.terminate();
  }, [currentIndex]); //Depender del indice y no del game.fen() actual

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

  const gameToRender = new Chess();
  historial.slice(0, currentIndex).forEach((mov) => gameToRender.move(mov));

  const chessboardOptions: ChessboardOptions = {
    position: gameToRender.fen(),
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
        <button className="botonIdea" onClick={handleIdea}>
          <FontAwesomeIcon icon={faLightbulb} />
        </button>
      </div>
    </div>
  );
}

export default App;
