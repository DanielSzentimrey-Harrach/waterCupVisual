/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.IVisualHost;
import * as d3 from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;
import { VisualFormattingSettingsModel } from "./settings";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

interface WaterCupData {
    category: string;
    comments: string;
    height: number;
    width: number;
    fillRate: number;
    colorLevel: string;
}

interface WaterCupViewModel {
    data: WaterCupData[];
}



function scaleNumber(inputMin: number, inputMax: number, outputMin: number, outputMax: number, inputValue: number, rootN: number): number {
    inputMin = Math.pow(inputMin, 1 / rootN);
    inputMax = Math.pow(inputMax, 1 / rootN);
    inputValue = Math.pow(inputValue, 1 / rootN);
    return ((inputValue - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin) + outputMin;
}

function interpolateColor(color1: string, color2: string, factor: number): string {
    const a = parseInt(color1.slice(1, 7), 16),
        b = parseInt(color2.slice(1, 7), 16),
        aR = a >> 16,
        aG = a >> 8 & 0xff,
        aB = a & 0xff,
        bR = b >> 16,
        bG = b >> 8 & 0xff,
        bB = b & 0xff,
        resultR = (aR + factor * (bR - aR)),
        resultG = (aG + factor * (bG - aG)),
        resultB = (aB + factor * (bB - aB));

    return '#' + ((1 << 24) + (resultR << 16) + (resultG << 8) + resultB).toString(16).slice(1, 7);
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.host = options.host;
        this.target = options.element;
        options.element.style.overflow = "auto";
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        let vpWidth: number = options.viewport.width // divide by 2 because there are two divs
        let vpHeight: number = options.viewport.height;

        const dataView: powerbi.DataView = options.dataViews[0];

        //const maxDivWidth = 300;
        //let divWidth = Math.min(vpWidth, maxDivWidth);
        const cupCanvasWidth = this.formattingSettings.cupCard.cupCanvasGroupSettings.width.value;
        const cupCanvasHeight = this.formattingSettings.cupCard.cupCanvasGroupSettings.height.value;

        let viewModel: WaterCupViewModel = this.visualTransform(dataView, cupCanvasWidth, cupCanvasHeight);

        this.target.innerHTML = '';
        const outerContainer = document.createElement('div');
        outerContainer.className = 'outerContainer';
        this.target.appendChild(outerContainer);

        for (let i = 0; i < viewModel.data.length; i++) {
            const containerDiv = document.createElement('div');
            containerDiv.style.width = cupCanvasWidth + 10 + 'px';
            containerDiv.className = 'innerContainer';
            containerDiv.style.backgroundColor = this.formattingSettings.containerCard.containerBackgroundGroup.backgroundColor.value.value;
            containerDiv.style.border = this.formattingSettings.containerCard.containerBorderGroup.borderThickness.value + 'px solid ' + this.formattingSettings.containerCard.containerBorderGroup.borderColor.value.value;
            outerContainer.appendChild(containerDiv);

            const cupDiv = document.createElement('div');
            cupDiv.style.height = cupCanvasHeight + 'px';
            cupDiv.style.margin = '5px';
            let cup = this.getCup(viewModel.data[i].height, viewModel.data[i].width, viewModel.data[i].fillRate, cupCanvasWidth, cupCanvasHeight);
            cupDiv.appendChild(cup.node());
            d3.select(cup.node()).style('background-color', this.formattingSettings.cupCard.cupCanvasGroupSettings.backgroundColor.value.value);
            d3.select(cup.node()).selectAll('.filledArea').style('fill', viewModel.data[i].colorLevel);
            containerDiv.appendChild(cupDiv);

            const categoryHeader = document.createElement('h3');
            categoryHeader.innerText = viewModel.data[i].category;
            categoryHeader.style.fontFamily = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.fontFamily.value;
            categoryHeader.style.fontSize = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.fontSize.value + 'px';
            categoryHeader.style.fontWeight = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.bold.value ? 'bold' : 'normal';
            categoryHeader.style.fontStyle = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.italic.value ? 'italic' : 'normal';
            categoryHeader.style.textDecoration = this.formattingSettings.textCard.textCategoryGroupSettings.categoryFormat.underline.value ? 'underline' : 'none';
            categoryHeader.style.color = this.formattingSettings.textCard.textCategoryGroupSettings.categoryColor.value.value;
            categoryHeader.style.textAlign = this.formattingSettings.textCard.textCategoryGroupSettings.categoryAlignment.value;
            containerDiv.appendChild(categoryHeader);

            const commentsParagraph = document.createElement('p');
            commentsParagraph.innerText = viewModel.data[i].comments;
            commentsParagraph.style.fontFamily = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.fontFamily.value;
            commentsParagraph.style.fontSize = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.fontSize.value + 'px';
            commentsParagraph.style.fontWeight = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.bold.value ? 'bold' : 'normal';
            commentsParagraph.style.fontStyle = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.italic.value ? 'italic' : 'normal';
            commentsParagraph.style.textDecoration = this.formattingSettings.textCard.textCommentGroupSettings.commentFormat.underline.value ? 'underline' : 'none';
            commentsParagraph.style.color = this.formattingSettings.textCard.textCommentGroupSettings.commentColor.value.value;
            commentsParagraph.style.textAlign = this.formattingSettings.textCard.textCommentGroupSettings.commentAlignment.value;
            containerDiv.appendChild(commentsParagraph);
        }

        if (this.formattingSettings.legendCard.show.value) {
            const outerContainerWidth = outerContainer.offsetWidth;
            const containerDivWidth = cupCanvasWidth + 10 + 20 + 2 * this.formattingSettings.containerCard.containerBorderGroup.borderThickness.value; // 2 * 5px margin aroound cupCanvas + 2 * 10px margin around container + 2 * border thickness
            const containerDivsPerRow = Math.floor(outerContainerWidth / containerDivWidth);
            
            const legendDiv = document.createElement('div');
            legendDiv.className = 'legendContainer';
            legendDiv.innerHTML = "<b>Height:</b> " + this.formattingSettings.legendCard.heightText.value+ '<br>'
                + '<b>Width:</b> ' + this.formattingSettings.legendCard.widthText.value + '<br>'
                + '<b>Water Level:</b> ' + this.formattingSettings.legendCard.waterLevelText.value + '<br>'
                + '<b>Water Color:</b> ' + this.formattingSettings.legendCard.waterColorText.value;
            legendDiv.style.fontFamily = this.formattingSettings.legendCard.legendFontFamily.value;
            legendDiv.style.fontSize = this.formattingSettings.legendCard.legendFontSize.value + 'px';
            legendDiv.style.color = this.formattingSettings.legendCard.legendFontColor.value.value;
            legendDiv.style.backgroundColor = this.formattingSettings.legendCard.legendBackgroundColor.value.value;
            legendDiv.style.margin = '10px';
            legendDiv.style.padding = '5px';
            legendDiv.style.width = containerDivsPerRow * containerDivWidth - 30 + 'px'; // 30px is the 2 * 10 px margin around the outerContainer, plus the 2 * 5px padding within the label container
            this.target.appendChild(legendDiv);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private getCup(height: number, width: number, fillRate: number, containerWidth: number, containerHeight: number): Selection<SVGElement> {
        let svg = d3.create('svg')
            .classed('ovalDiagram', true)
            .attr("width", containerWidth)
            .attr("height", containerHeight);
        const container = svg.append("g")
            .classed('container', true);

        const bottomOvalShrink = 0.65;

        const cx = containerWidth / 2;
        const cy = 0.9 * containerHeight - height / 2;
        
        const bottomY = cy + height / 2;
        const topY = cy - height / 2;
        const topR = width / 2;
        const bottomR = width / 2 * bottomOvalShrink;
        const liquidR = bottomR + (topR - bottomR) * fillRate;

        const strokeColor = this.formattingSettings.cupCard.cupVisualGroupSettings.strokeColor.value.value;
        const strokeThickness = this.formattingSettings.cupCard.cupVisualGroupSettings.strokeThickness.value;

        // Draw fill, first, so it'll be at the bottom
        const bottomOval = container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", cy + height / 2)
            .attr("rx", bottomR)
            .attr("ry", bottomR / 5)
            .classed('filledArea', true)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // Define the points for the path
        let points = [
            { x: cx - liquidR, y: bottomY - height * fillRate }, // top left point of the top oval
            { x: cx + liquidR, y: bottomY - height * fillRate }, // top right point of the top oval
            { x: cx + bottomR, y: bottomY }, // bottom right point of the bottom oval
            { x: cx - bottomR, y: bottomY }  // bottom left point of the bottom oval
        ];

        // Define the line generator
        let line = d3.line()
            .x(function (d) { return d[0]; })
            .y(function (d) { return d[1]; });

        // Append the path and apply the line generator
        const filledArea = container.append("path")
            .attr("d", line(points.map(p => [p.x, p.y])))
            .classed('filledArea', true)
            .style("stroke", "none");

        const liquidTopOval = container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", bottomY - height * fillRate)
            .attr("rx", liquidR)
            .attr("ry", liquidR / 5)
            .classed('filledArea', true)
            .style("stroke-width", strokeThickness)
            .style("stroke", "grey");

        // Draw the rest of the cup
        // Create the larger oval at the top
        const topOval = container.append("ellipse")
            .attr("cx", cx)
            .attr("cy", topY)
            .attr("rx", topR)
            .attr("ry", topR / 5)
            .classed('topOval', true)
            .style("fill", "transparent")
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // Create the left line connecting the ovals
        const leftLine = container.append("line")
            .attr("x1", cx - topR)
            .attr("y1", topY)
            .attr("x2", cx - bottomR)
            .attr("y2", bottomY)
            .classed('leftLine', true)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        // Create the right line connecting the ovals
        const rightLine = container.append("line")
            .attr("x1", cx + topR)
            .attr("y1", topY)
            .attr("x2", cx + bottomR)
            .attr("y2", bottomY)
            .classed('rightLine', true)
            .style("stroke-width", strokeThickness)
            .style("stroke", strokeColor);

        return svg;
    }

    private visualTransform(dataView: powerbi.DataView, width: number, height: number): WaterCupViewModel {
        let viewModel: WaterCupViewModel = {
            data: []
        };

        if (!dataView
            || !dataView.categorical
            || !dataView.categorical.categories
            || !dataView.categorical.categories[0].source
            || !dataView.categorical.values
        ) {
            return viewModel;
        }

        let categories = dataView.categorical.categories[0];
        let comments = dataView.categorical.values[0];
        let rawHeights = dataView.categorical.values[1];
        let rawHeightMin = <number>dataView.categorical.values[1].minLocal;
        let rawHeightMax = <number>dataView.categorical.values[1].maxLocal;
        let rawWidths = dataView.categorical.values[2];
        let rawWidthMin = <number>dataView.categorical.values[2].minLocal;
        let rawWidthMax = <number>dataView.categorical.values[2].maxLocal;
        let rawFillRates = dataView.categorical.values[3];
        let rawFillRatesMin = <number>dataView.categorical.values[3].minLocal;
        let rawFillRatesMax = <number>dataView.categorical.values[3].maxLocal;
        let rawColorLevels = dataView.categorical.values[4];
        let rawColorLevelsMin = <number>dataView.categorical.values[4].minLocal;
        let rawColorLevelsMax = <number>dataView.categorical.values[4].maxLocal;

        const maxHeight = height * 0.8;
        const minHeight = height * 0.2;
        const maxWidth = width * 0.95;
        const minWidth = width * 0.2;

        for (let i = 0; i < Math.max(categories.values.length, comments.values.length, rawHeights.values.length, rawWidths.values.length, rawFillRates.values.length, rawColorLevels.values.length); i++) {


            viewModel.data.push({
                category: <string>categories.values[i],
                comments: <string>comments.values[i],
                height: scaleNumber(rawHeightMin, rawHeightMax, minHeight, maxHeight, <number>rawHeights.values[i], 3),
                width: scaleNumber(rawWidthMin, rawWidthMax, minWidth, maxWidth, <number>rawWidths.values[i], 3),
                fillRate: scaleNumber(rawFillRatesMin, rawFillRatesMax, 0.1, 0.9, <number>rawFillRates.values[i], 1),
                colorLevel: interpolateColor(this.formattingSettings.cupCard.cupVisualGroupSettings.waterColorLow.value.value,
                    this.formattingSettings.cupCard.cupVisualGroupSettings.waterColorLow.value.value,
                    scaleNumber(rawColorLevelsMin, rawColorLevelsMax, 0.01, 0.99, <number>rawColorLevels.values[i], 1))
            });
        }

        return viewModel;
    }
}