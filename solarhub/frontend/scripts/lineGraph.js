import DOM from "./dom.js";

export default class LineGraph {
   constructor() {
      this.data = {};
      this.container = DOM.create("div.lineGraphContainer");
      this.titleText = DOM.create("t.bigTitle").setStyle({ margin: "0px" }).appendTo(this.container);
      this.subTitleText = DOM.create("t.subTitle").setStyle({ margin: "0px" }).appendTo(this.container);
      this.canvas = DOM.create("canvas.lineGraphCanvas").appendTo(this.container);
      this.tickLineContainer = DOM.create("div.lineGraphTickLineContainer").appendTo(this.container);
      this.labelContainer = DOM.create("div.lineGraphLabelContainer").appendTo(this.container);
      this.hoverBox = DOM.create("div#hoverBox").appendTo(this.container);
      this.hoverLine = DOM.create("div#hoverLine").appendTo(this.container);

      // Graph Hovering
      this.mouseX = undefined;
      const canvas = this.canvas.getFirstElement();
      canvas.addEventListener("mousemove", (event) => {
         const rect = canvas.getBoundingClientRect();
         const relX = event.clientX - rect.left;
         const relY = event.clientY - rect.top;
         this.hoverOverview(relX, relY);
      });
      canvas.addEventListener("mouseleave", () => {
         this.hoverOverview(undefined, undefined);
      });
      canvas.addEventListener("touchmove", (event) => {
         const rect = canvas.getBoundingClientRect();
         const relX = event.touches[0].clientX - rect.left;
         const relY = event.touches[0].clientY - rect.top;
         this.hoverOverview(relX, relY);
      });
      canvas.addEventListener("touchend", () => {
         this.hoverOverview(undefined, undefined);
      });
   }
   setTitle(title) {
      this.title = title;
      this.titleText.setText(this.title);
   }
   setSubTitle(subTitle) {
      this.subTitle = subTitle;
      this.subTitleText.setText(subTitle);
   }
   setLabels(labels) {
      const containerWidth = this.labelContainer.getFirstElement().clientWidth;
      let labelFontSize = containerWidth / labels.length / 2;
      if (labelFontSize < 10) labelFontSize = 10;
      if (labelFontSize > 18) labelFontSize = 18;
      this.labelContainer.setContent("");
      for (let label of labels) {
         DOM.create("t.lineGraphLabel")
            .append(
               DOM.create("span")
                  .setStyle({
                     fontSize: labelFontSize + "px",
                  })
                  .setContent(label),
            )
            .appendTo(this.labelContainer);
      }

      this.tickLineContainer.setContent("");
      for (let i = 0; i < labels.length + 1; i++) {
         DOM.create("t.lineGraphTickLine").appendTo(this.tickLineContainer);
      }
   }
   draw() {
      const canvas = this.canvas.getFirstElement();
      let height = canvas.clientHeight;
      let width = canvas.clientWidth;
      let ctx = canvas.getContext("2d");
      let pixelFactor = window.devicePixelRatio;
      canvas.setAttribute("height", height * pixelFactor);
      canvas.setAttribute("width", width * pixelFactor);
      ctx.scale(pixelFactor, pixelFactor);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 3;
      ctx.clearRect(0, 0, width, height);

      const drawCurve = (values, color, scalingFactor) => {
         const stepSize = width / (values.length - 1);
         const yOffset = -2;

         let pathStartX = 0;
         for (let i = 0; i < values.length; i++) {
            let currentValue = values[i];
            let prevValue = values[i - 1];
            let nextValue = values[i + 1];

            if (isNaN(currentValue)) continue;
            const x = i * stepSize;
            const y = height - currentValue * scalingFactor + yOffset;

            if (isNaN(prevValue)) {
               ctx.beginPath();
               const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
               gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a == 1 ? 0.4 : 0})`);
               gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
               ctx.fillStyle = gradient;
               ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
               pathStartX = x;
               ctx.moveTo(x, y);
               continue;
            }
            if (isNaN(nextValue)) {
               ctx.lineTo(x, y);
               ctx.stroke();
               ctx.lineTo(x, height);
               ctx.lineTo(pathStartX, height);
               ctx.fill();
               continue;
            }
            const nextX = (i + 1) * stepSize;
            const nextY = height - nextValue * scalingFactor + yOffset;
            const cpx = (x + nextX) / 2;
            const cpy = (y + nextY) / 2;
            ctx.quadraticCurveTo(x, y, cpx, cpy);
         }

         // Draw Hover
         // if (this.mouseX !== undefined) {
         //    ctx.beginPath();
         //    ctx.lineWidth = "3";
         //    const textColor = getComputedStyle(document.documentElement).getPropertyValue("--textColor");
         //    ctx.strokeStyle = textColor.trim();
         //    ctx.moveTo(this.mouseX, 0);
         //    ctx.lineTo(this.mouseX, height);
         //    ctx.stroke();

         //    const index = Math.round(this.mouseX / step);
         //    const elem = values[index];
         //    // const val = Math.max(Math.round(elem[key] || 0), 0);
         //    // if (key == "a") this.sunEnergyValueText.setText(val);
         //    // if (key == "b") this.houseEnergyValueText.setText(val);
         //    // this.sunEnergyUnitText.setText("Watt");
         //    // this.houseEnergyUnitText.setText("Watt");
         // } else {
         //    // this.sunEnergyValueText.setText((this.sunEnergy / 1000).toThreeDecimalString());
         //    // this.sunEnergyUnitText.setText("kWh");
         //    // this.houseEnergyValueText.setText((this.houseEnergy / 1000).toThreeDecimalString());
         //    // this.houseEnergyUnitText.setText("kWh");
         // }
      };

      const enabledData = Object.values(this.data).filter((v) => v.enabled);
      const scalingGroups = [];
      enabledData.forEach((a) => {
         const scalingGroup = a.scalingGroup;
         if (!scalingGroups.includes(scalingGroup)) {
            scalingGroups.push(scalingGroup);
         }
      });
      for (let scalingGroup of scalingGroups) {
         const groupData = enabledData.filter((a) => a.scalingGroup == scalingGroup);
         const maxValue = Math.max(...groupData.flatMap((a) => a.values.filter((v) => !isNaN(v))));
         groupData.forEach((a) => {
            let scalingFactor = (height - 5) / maxValue;
            drawCurve(a.values, a.color, scalingFactor);
         });
      }
   }

   hoverOverview(x, y) {
      const width = this.canvas.getFirstElement().clientWidth;
      if (x && y) {
         this.hoverBox.setContent("");
         const enabledHoverData = Object.values(this.data)
            .filter((a) => a.enabled)
            .filter((a) => a.showInHover);
         enabledHoverData.forEach((a) => {
            const stepSize = width / (a.values.length - 1);
            const index = Math.round(x / stepSize);
            this.hoverBox.append(
               DOM.create("t")
                  .setText(a.name + ": " + Math.round(a.values[index] || 0) + " " + a.unit)
                  .setStyle({ color: `rgb(${a.color.r}, ${a.color.g}, ${a.color.b})`, display: "block" }),
            );
         });

         const hoverBoxWidth = this.hoverBox.getWidth();
         const adjustedX = x - hoverBoxWidth * (x / width);
         const hoverBoxHeight = this.hoverBox.getHeight();
         const adjustedY = -hoverBoxHeight + 60;
         this.hoverBox.setStyle({ opacity: "1", left: adjustedX + "px", top: adjustedY + "px" });
         this.hoverLine.setStyle({ opacity: "1", left: x + "px" });
      } else {
         setTimeout(() => {
            this.hoverBox.setStyle({ opacity: "0" });
            this.hoverLine.setStyle({ opacity: "0" });
         }, 10);
      }
   }
}
