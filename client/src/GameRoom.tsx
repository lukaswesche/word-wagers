import Bidding from './Bidding';
import Guessing from './Guessing';
import Lobby from './Lobby';
import Performing from './Performing';
import Resolved from './Resolved';
import type { RoomState } from './types';

type Props = {
  room: RoomState;
  myId: string | null;
};

function GameRoom({ room, myId }: Props) {
  switch (room.phase) {
    case 'lobby':
      return <Lobby room={room} myId={myId} />;
    case 'bidding':
      return <Bidding room={room} myId={myId} />;
    case 'performing':
      return <Performing room={room} myId={myId} />;
    case 'guessing':
      return <Guessing room={room} myId={myId} />;
    case 'resolved':
      return <Resolved room={room} myId={myId} />;
  }
}

export default GameRoom;
