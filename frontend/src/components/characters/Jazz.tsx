"use client";

interface JazzProps {
  walking?: boolean;
  scale?: number;
  direction?: "right" | "left";
  talking?: boolean;
}

// Jazz — the AI dispatcher. Navy blazer, gold tie & headset, confident.
export default function Jazz({
  walking = true,
  scale = 1,
  direction = "right",
  talking = false,
}: JazzProps) {
  const d = (n: number) => `${n * scale}px`;
  const dur = "0.6s";
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
          {/* Headset band */}
          <div
            style={{
              position: "absolute",
              top: d(-8),
              left: d(-2),
              width: d(34),
              height: d(22),
              borderRadius: "50%",
              border: `${3 * scale}px solid #FFD33B`,
              borderBottom: "none",
            }}
          />
          {/* Left ear cup */}
          <div
            style={{
              position: "absolute",
              top: d(6),
              left: d(-8),
              width: d(8),
              height: d(12),
              background: "#FFD33B",
              borderRadius: d(4),
            }}
          />
          {/* Right ear cup + mic boom */}
          <div
            style={{
              position: "absolute",
              top: d(6),
              right: d(-8),
              width: d(8),
              height: d(12),
              background: "#FFD33B",
              borderRadius: d(4),
            }}
          />
          {/* Mic boom */}
          <div
            style={{
              position: "absolute",
              top: d(14),
              right: d(-18),
              width: d(14),
              height: d(3),
              background: "#FFD33B",
              borderRadius: d(2),
            }}
          />
          <div
            style={{
              position: "absolute",
              top: d(11),
              right: d(-22),
              width: d(7),
              height: d(7),
              borderRadius: "50%",
              background: "#FFD33B",
            }}
          />

          {/* Face */}
          <div
            style={{
              width: d(30),
              height: d(30),
              borderRadius: "50%",
              background: "#C8956A",
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
            {/* Mouth — animates when talking */}
            <div
              style={{
                position: "absolute",
                bottom: d(8),
                left: "50%",
                transform: "translateX(-50%)",
                width: d(12),
                height: talking ? d(10) : d(5),
                borderBottom: "2.5px solid #1a1a1a",
                borderLeft: "2.5px solid #1a1a1a",
                borderRight: "2.5px solid #1a1a1a",
                borderRadius: "0 0 12px 12px",
                transition: "height 0.1s ease-in-out",
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
              animation: walking
                ? `arm-back ${dur} ease-in-out infinite`
                : "none",
            }}
          >
            <div
              style={{
                width: d(11),
                height: d(30),
                borderRadius: d(5),
                background: "#1E1E4A",
              }}
            />
            <div
              style={{
                width: d(10),
                height: d(10),
                borderRadius: "50%",
                background: "#C8956A",
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
                background: "#1E1E4A",
              }}
            />
            <div
              style={{
                width: d(10),
                height: d(10),
                borderRadius: "50%",
                background: "#C8956A",
                marginTop: d(-2),
                marginLeft: d(0.5),
              }}
            />
          </div>

          {/* Navy blazer */}
          <div
            style={{
              width: d(38),
              height: d(40),
              borderRadius: `${d(8)} ${d(8)} ${d(4)} ${d(4)}`,
              background: "#1E1E4A",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* White shirt */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: d(15),
                height: "100%",
                background: "#f0ebe0",
              }}
            />
            {/* Gold tie */}
            <div
              style={{
                position: "absolute",
                top: d(2),
                left: "50%",
                transform: "translateX(-50%)",
                width: d(5),
                height: d(22),
                background: "#FFD33B",
                borderRadius: `${d(2)} ${d(2)} ${d(4)} ${d(4)}`,
                clipPath: "polygon(20% 0%, 80% 0%, 100% 60%, 50% 100%, 0% 60%)",
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
                background: "#16163A",
              }}
            />
            <div
              style={{
                width: d(18),
                height: d(8),
                borderRadius: `0 ${d(8)} ${d(8)} ${d(3)}`,
                background: "#111111",
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
                background: "#16163A",
              }}
            />
            <div
              style={{
                width: d(18),
                height: d(8),
                borderRadius: `0 ${d(8)} ${d(8)} ${d(3)}`,
                background: "#111111",
                marginLeft: d(-1),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
