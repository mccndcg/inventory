import { useObservable } from "dexie-react-hooks";
import { db } from "~/data/dexie";
import { resolveText, DXCInputField } from "dexie-cloud-addon";
import { useState } from "react";

export function LoginGUI() {
  const ui = useObservable(db.cloud.userInteraction);
  const [params, setParams] = useState<{ [param: string]: string }>({});

  if (!ui) return <span>Already logged in</span>;
  return (
    <div>
      <h3>{ui.title}</h3>
      {ui.alerts?.map((alert, i) => (
        <p key={i} className={`dxcdlg-alert-${alert.type}`}>
          {resolveText(alert)}
        </p>
      ))}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          ui.onSubmit(params);
        }}
      >
        {(Object.entries(ui.fields) as [string, DXCInputField][]).map(
          ([fieldName, { type, label, placeholder }], idx) => (
            <label key={idx}>
              {label ? `${label}: ` : ""}
              <input
                type={type}
                name={fieldName}
                placeholder={placeholder}
                value={params[fieldName] || ""}
                onChange={(ev) => {
                  const value = ev.target.value;
                  const updatedParams = {
                    ...params,
                    [fieldName]: value,
                  };
                  setParams(updatedParams);
                }}
              />
            </label>
          )
        )}
      </form>
    </div>
  );
}
