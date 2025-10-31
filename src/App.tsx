import { useState } from "react";
import { Chessboard } from "react-chessboard";
import type { ChessboardOptions, PieceDropHandlerArgs } from "react-chessboard";
import { Chess } from "chess.js";
import { useId } from "react";
import { useEffect, useRef } from "react";
import "./App.css";

function App() {
  const [game, setGame] = useState(new Chess());
  const [feedback, setFeedback] = useState("");
  const [historial, setHistorial] = useState<string[]>([]);
  const postTextAreaId = useId();
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (contenedorRef.current) {
      contenedorRef.current.scrollTop = contenedorRef.current.scrollHeight;
    }
  }, [historial]);

  const movimiento = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare) {
      setFeedback("Movimiento ilegal");
      return false;
    }

    const newGame = new Chess(game.fen());
    const jugada = newGame.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });

    if (!jugada) {
      setFeedback("Movimiento ilegal");
      return false;
    }

    setHistorial((prev) => [...prev, jugada.san]);

    setGame(newGame);

    setFeedback(`✅ Jugada válida: ${jugada.san}`);

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

      <div className="cuadroRegistroPartida" ref={contenedorRef}>
        <h3 style={{ textAlign: "center" }}></h3>
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
