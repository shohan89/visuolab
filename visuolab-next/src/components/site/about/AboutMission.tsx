import { st } from "@/lib/css";

export default function AboutMission() {
  return (
    <>
      <section className="sec" aria-label="Mission and vision"><div className="wrap"><div className="mv"><div className="mv-card reveal" style={st({ "--i": "0" })}><span className="tag">The image of the future</span><h3>Mission</h3><p>{"To design brands, products and websites that carry one idea faithfully from the first sketch to the last screen — with small senior teams, honest advice, and the patience to stay past launch and keep improving what we shipped."}</p></div><div className="mv-card reveal" style={st({ "--i": "1" })}><span className="tag">Our ambition</span><h3>Vision</h3><p>{"To be the studio founders call first — trusted with the work that defines a company, still around when it's time to evolve it, and a place where every launch raises the bar for the next one."}</p></div></div></div></section>
    </>
  );
}
