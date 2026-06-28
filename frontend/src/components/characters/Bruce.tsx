"use client";

interface BruceProps {
  walking?: boolean;
  scale?: number;
  direction?: "right" | "left";
  waving?: boolean;
}

// Bruce — the truck driver. Green jacket, black cap, cheerful.
export default function Bruce({
  walking = true,
  scale = 1,
  direction = "right",
  waving = false,
}: BruceProps) {
  const d = (n: number) => `${n * scale}px`;
  const dur = "0.55s";
  const flip = direction === "left" ? "scaleX(-1)" : "scaleX(1)";

  return (
    <div
      style={{
        width: d(64),
        height: d(118),
        position: "relative",
        flexShrink: 0,
        transform: flip,
      }}
    >
      {/* Ground shadow */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: d(46),
          height: d(7),
          borderRadius: "50%",
          background: "rgba(0,0,0,0.2)",
          filter: "blur(4px)",
        }}
      />

      {/* Body group — bobs while walking */}
      <div
        style={{
          position: "absolute",
          bottom: d(7),
          left: "50%",
          transform: "translateX(-50%)",
          width: d(44),
          animation: walking ? `body-walk ${dur} ease-in-out infinite` : "none",
        }}
      >
        {/* ── HEAD ── */}
        <div
          style={{
            position: "relative",
            margin: "0 auto",
            width: d(30),
            marginBottom: d(3),
          }}
        >
          {/* Cap dome */}
          <div
            style={{
              position: "absolute",
              top: d(-11),
              left: d(-1),
              width: d(32),
              height: d(16),
              borderRadius: "50% 50% 0 0",
              background: "#111111",
            }}
          />
          {/* Cap brim */}
          <div
            style={{
              position: "absolute",
              top: d(3),
              left: d(-6),
              width: d(42),
              height: d(5),
              borderRadius: d(3),
              background: "#0a0a0a",
            }}
          />
          {/* Face */}
          <div
            style={{
              width: d(30),
              height: d(30),
              borderRadius: "50%",
              background: "#F4B09A",
              position: "relative",
            }}
          >
            {/* Eyes */}
            <div
              style={{
                position: "absolute",
                top: d(11),
                left: d(7),
                width: d(4),
                height: d(4),
                borderRadius: "50%",
                background: "#1a1a1a",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: d(11),
                right: d(7),
                width: d(4),
                height: d(4),
                borderRadius: "50%",
                background: "#1a1a1a",
              }}
            />
            {/* Smile */}
            <div
              style={{
                position: "absolute",
                bottom: d(8),
                left: "50%",
                transform: "translateX(-50%)",
                width: d(12),
                height: d(6),
                borderBottom: "2.5px solid #1a1a1a",
                borderLeft: "2.5px solid #1a1a1a",
                borderRight: "2.5px solid #1a1a1a",
                borderRadius: "0 0 12px 12px",
              }}
            />
          </div>
        </div>

        {/* ── TORSO + ARMS ── */}
        <div style={{ position: "relative", width: d(38), margin: "0 auto" }}>
          {/* Left arm */}
          <div
            style={{
              position: "absolute",
              left: d(-12),
              top: d(2),
              transformOrigin: "top center",
              animation: waving
                ? `arm-wave 0.8s ease-in-out infinite`
                : walking
                ? `arm-back ${dur} ease-in-out infinite`
                : "none",
            }}
          >
            <div
              style={{
                width: d(11),
                height: d(30),
                borderRadius: d(5),
                background: "#3D9A5E",
              }}
            />
            <div
              style={{
                width: d(10),
                height: d(10),
                borderRadius: "50%",
                background: "#F4B09A",
                marginTop: d(-2),
                marginLeft: d(0.5),
              }}
            />
          </div>

          {/* Right arm */}
          <div
            style={{
              position: "absolute",
              right: d(-12),
              top: d(2),
              transformOrigin: "top center",
              animation: walking
                ? `arm-front ${dur} ease-in-out infinite`
                : "none",
            }}
          >
            <div
              style={{
                width: d(11),
                height: d(30),
                borderRadius: d(5),
                background: "#3D9A5E",
              }}
            />
            <div
              style={{
                width: d(10),
                height: d(10),
                borderRadius: "50%",
                background: "#F4B09A",
                marginTop: d(-2),
                marginLeft: d(0.5),
              }}
            />
          </div>

          {/* Jacket body */}
          <div
            style={{
              width: d(38),
              height: d(40),
              borderRadius: `${d(8)} ${d(8)} ${d(4)} ${d(4)}`,
              background: "#3D9A5E",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Shirt showing between open jacket */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: d(15),
                height: "100%",
                background: "#EDE8DC",
              }}
            />
            {/* Left chest pocket */}
            <div
              style={{
                position: "absolute",
                bottom: d(10),
                left: d(5),
                width: d(9),
                height: d(9),
                border: `${1.5 * scale}px solid rgba(0,0,0,0.2)`,
                borderRadius: d(2),
              }}
            />
            {/* Right chest pocket */}
            <div
              style={{
                position: "absolute",
                bottom: d(10),
                right: d(5),
                width: d(9),
                height: d(9),
                border: `${1.5 * scale}px solid rgba(0,0,0,0.2)`,
                borderRadius: d(2),
              }}
            />
          </div>
        </div>

        {/* ── LEGS ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: d(4),
            marginTop: d(2),
          }}
        >
          {/* Left leg */}
          <div
            style={{
              transformOrigin: "top center",
              animation: walking
                ? `leg-back ${dur} ease-in-out infinite`
                : "none",
            }}
          >
            <div
              style={{
                width: d(15),
                height: d(28),
                borderRadius: `${d(4)} ${d(4)} 0 0`,
                background: "#D4C8A8",
              }}
            />
            <div
              style={{
                width: d(18),
                height: d(8),
                borderRadius: `0 ${d(8)} ${d(8)} ${d(3)}`,
                background: "#1a1a1a",
                marginLeft: d(-1),
              }}
            />
          </div>

          {/* Right leg */}
          <div
            style={{
              transformOrigin: "top center",
              animation: walking
                ? `leg-front ${dur} ease-in-out infinite`
                : "none",
            }}
          >
            <div
              style={{
                width: d(15),
                height: d(28),
                borderRadius: `${d(4)} ${d(4)} 0 0`,
                background: "#D4C8A8",
              }}
            />
            <div
              style={{
                width: d(18),
                height: d(8),
                borderRadius: `0 ${d(8)} ${d(8)} ${d(3)}`,
                background: "#1a1a1a",
                marginLeft: d(-1),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
