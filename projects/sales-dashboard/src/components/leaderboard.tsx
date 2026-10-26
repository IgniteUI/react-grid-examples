import { IgrAvatar, IgrList, IgrListItem } from "igniteui-react";
import { leaderboard } from "../data/sales-data";

/** The reps ranked by the amount they closed. */
export default function Leaderboard() {
  return (
    <IgrList>
      {leaderboard.map((person) => (
        <IgrListItem key={person.rank}>
          <div className="leader-row">
            <div className="leader-left">
              <IgrAvatar
                initials={person.rank.toString()}
                className={person.rank <= 3 ? `rank-badge rank-${person.rank}` : "rank-badge"}
              />
              <div>
                <div className="leader-name">{person.name}</div>
                <small>{person.quota}</small>
              </div>
            </div>
            <div className="leader-right">
              <div className="leader-amount">{person.amount}</div>
              <small className={person.positive ? undefined : "negative"}>{person.delta}</small>
            </div>
          </div>
        </IgrListItem>
      ))}
    </IgrList>
  );
}
