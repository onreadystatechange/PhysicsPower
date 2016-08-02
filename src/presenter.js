(function () {

    // 边界控制
    var PANEL_BORDER = {};

    var TAG = {
      'CREATE_CONCURRENT_F':0,
      'CREATE_F_OR_FP':1,
      'DRAG_F_OR_FP':2
    };

    // 验证创建的 力 or 作用点 or 共点力 单例
    var CreationOperationVerification = {
      verifyFOrFPCreation: function(args) {
        if (currentPanelState == STATE.CAN_DRAW_FP) {
          if (Utils.calDistance(args.downPos.x, args.downPos.y, args.upPos.x, args.upPos.y) > 10) {
            // 创建作用点失败
            args.actionPoint.structurallyDestroy();
          } else {
            // 创建作用点成功
            ++pIdx;
            pIdxContainer.add(pIdx);
            args.actionPoint.setVirtual(false);
            handler.sendMessage({
                identify: MESSAGE.ADD_POINT,
                target: args.actionPoint
            });
          }
        }
        if (currentPanelState == STATE.CAN_DRAW_F) {
          var dis = Utils.calDistance(args.downPos.x, args.downPos.y, args.upPos.x, args.upPos.y);
          if (dis > 26) {
            // 创建力成功
            ++fIdx;
            fIdxContainer.add(fIdx);
            if (args.tmpF) {
              args.tmpF.setVirtual(false);// 设置为真实的力
              args.tmpF.possessActionPoint(possessActionPoint);// 设置力是否有作用点
            }
            if (!possessActionPoint) {
              // 无作用点，保持虚拟状态
              args.actionPoint.setName("");
            }
            handler.sendMessage({
              identify: MESSAGE.ADD_FORCE_WITH_POINT,
              target: args.tmpF
            });
          } else {
            // 销毁作用点和力
            args.actionPoint.structurallyDestroy();// 点 与 力 已经绑定在一起了，删除点连带删除力，删除力也会连带删除虚拟作用点
          }
        }
      },
      verifyConcurrentForcesCreation: function(args) {
        // 处理共点力的验证逻辑
        if (args.concurrentForce) {
          // 已经创建了临时的共点力对象了
          if (Utils.calDistance(args.fPRef.x, args.fPRef.y, args.pos.x, args.pos.y) > 26) {
            // 创建共点力成功
            ++fIdx;
            fIdxContainer.add(fIdx);
            args.concurrentForce.setVirtual(false);
            Consult.askMeetFCFDCondition();
            // 记录用户的一次创建操作
            handler.sendMessage({
              identify: MESSAGE.ADD_CONCURRENT_FORCE,
              target: args.concurrentForce
            });
          } else {
            // 创建共点力失败，解除作用点的关联
            args.fPRef.unbindConcurrentForce(args.concurrentForce);
            // 结构式销毁力视图
            args.concurrentForce.structurallyDestroy();
          }
        }
      }
    };

    /**
     * 工具类方法
     */
    var Utils = {
        getEvent: function (event) {// 获取event对象
            return event ? event : window.event;
        },
        preventDefault: function (event) {//阻止浏览器默认行为
            if (event.preventDefault) {
                event.preventDefault();
            } else {
                event.returnValue = false;
            }
        },
        stopPropagation: function (event) {//阻止事件冒泡
            if (event.stopPropagation) {
                event.stopPropagation();
            } else {
                event.cancelBubble = true;
            }
        },
        forbidUserSelect: function ($region) {// 节点不可被鼠标选中
            $region
                .attr("unselectable", "on")
                .css({
                    "-moz-user-select": "-moz-none",
                    "-moz-user-select": "none",
                    "-o-user-select": "none",
                    "-khtml-user-select": "none",
                    "-webkit-user-select": "none",
                    "-ms-user-select": "none",
                    "user-select": "none"
                })
                .on("selectstart", function () {
                    return false;
                });
        },
        forbidScrollBar: function ($region) {// 节点禁用滚动条
            $region.css("overflow", "hidden");
        },
        conversionCursorPos: function (event, $container) {// 换算鼠标位置
            var pageX, pageY;
            if (event.clientX) {// pc端
                pageX = event.clientX;
                pageY = event.clientY;
            } else {// 移动端
                if (!event.originalEvent.targetTouches[0]) {// touchend事件
                    pageX = event.originalEvent.changedTouches[0].pageX;
                    pageY = event.originalEvent.changedTouches[0].pageY;
                } else {// touchmove事件
                    pageX = event.originalEvent.targetTouches[0].pageX;
                    pageY = event.originalEvent.targetTouches[0].pageY;
                }
            }
            return {
                x: pageX - $container.offset().left,
                y: pageY - $container.offset().top
            };
        },
        calDegree: function (x1, y1, x2, y2) {// 计算线段与水平线的夹角
            var dis = Utils.calDistance(x1, y1, x2, y2);
            var cos = Math.abs(x2 - x1) / dis;
            var degree = Math.acos(cos) * 180 / Math.PI;
            if (x1 < x2) {
                if (y1 > y2) {//逆时针旋转
                    degree = -degree;
                }
            } else {
                degree = y1 < y2 ? 180 - degree : -(180 - degree);
            }
            return degree;
        },
        calDistance: function (x1, y1, x2, y2) {// 计算两点之间的距离
            var disX = Math.abs(x1 - x2);
            var disY = Math.abs(y1 - y2);
            return Math.pow((disX * disX + disY * disY), 0.5);
        },
        getCurrentTimeMillis: function () {// 返回 1970 年 1 月 1 日至今的毫秒数，可以用来设置某时刻创建对象时的唯一ID
            return new Date().getTime();
        },
        set2GreyState: function ($node, state) {
            if (state) {
                if ($node.hasClass("disabled")) return;
                $node.addClass("disabled");
            } else {
                if ($node.hasClass("disabled")) $node.removeClass("disabled");
            }
        },
        set2CorrectState: function ($node, state) {
            if (state) {
                if ($node.hasClass("correct")) return;
                if ($node.hasClass("error")) $node.removeClass("error");
                $node.addClass("correct");
            } else {
                if ($node.hasClass("error")) return;
                if ($node.hasClass("correct")) $node.removeClass("correct");
                $node.addClass("error");
            }
        },
        set2ActiveState: function ($node, state) {
            if (state) {
                if ($node.hasClass("active")) return;
                $node.addClass('active');
            } else {
                if ($node.hasClass('active')) $node.removeClass("active");
            }
        },
        set2PenetrateState: function(nodes, state) {// 设置节点状态为事件穿透
          if(state) {
            for(var i = 0; i < nodes.length; ++i) {
              if(!nodes[i].hasClass('_penetrate')) {
                nodes[i].addClass('_penetrate');
              }
            }
          }else {
            for(var j = 0; j < nodes.length; ++j) {
              if(nodes[j].hasClass('_penetrate')) {
                nodes[j].removeClass('_penetrate');
              }
            }
          }
        },
        setText: function ($node, txt) {
            $node.text("" + txt);
        },
        applyBorderCtrl: function (args) {
          if (args.movePos && ((args.movePos.x >= PANEL_BORDER.RIGHT || args.movePos.x <= PANEL_BORDER.LEFT) || (args.movePos.y >= PANEL_BORDER.BOTTOM || args.movePos.y <= PANEL_BORDER.TOP))) {
            $panel.off("mousemove touchmove");
            $panel.off("touchend mouseup");

            switch (args.tag) {
              case TAG.CREATE_F_OR_FP:
                CreationOperationVerification.verifyFOrFPCreation({
                  'actionPoint':args.fPRef,
                  'tmpF':args.fRef,
                  'upPos':args.movePos,
                  'downPos':args.downPos,
                  'alreadyNewF':args.alreadyNewF
                });
                // console.log("CREATE_F_OR_FP BorderCtrl...");
                break;
              case TAG.CREATE_CONCURRENT_F:
                CreationOperationVerification.verifyConcurrentForcesCreation({
                  'fPRef': args.fPRef,
                  'pos': args.movePos,
                  'concurrentForce': args.concurrentForce,
                  'hasCreateConcurrentForceView': args.hasCreateConcurrentForceView
                });
                // console.log("CREATE_CONCURRENT_F BorderCtrl...");
                break;
              case TAG.DRAG_F_OR_FP:
                if(args.fRef) {
                  args.fRef.resetView2Normal();
                }
                if(args.fPRef) {
                  if (args.fPRef.view.$force_circle.hasClass("whole_drag")) {
                      args.fPRef.view.$force_circle.removeClass("whole_drag");
                  }
                }
                // console.log("DRAG_F_OR_FP BorderCtrl...");
                break;
            }
            Utils.set2PenetrateState([$compoundPopupWindow,$decomposePopupWindow],false);
            return true;
          }
          return false;
        }
    };

    /**
     * 视图控件声明
     */
    var $traverseParent,
        $panel,// 展示力的面板
        $btnUndo,// 撤销 && 恢复 按钮
        $btnRedo,
        $btnDrawFP,// 画作用点
        $btnDrawF,// 画作用力
        $btnFCompound,// 力的合成
        $compoundPopupWindow,// 合成按钮对应的底部弹出框
        $compoundPWCancel,
        $compoundFMarkedSpan,// 已经选择的需要合成的力的数量
        $compoundPWConfirm,
        $decomposeFMarkedSpan,// 已经选择的需要分解的力的数量
        $btnFDecompose,// 力的分解
        $decomposePopupWindow,// 分解按钮对应的底部弹出框
        $decomposePWConfirm,
        $decomposePWCancel,
        $btnCleanUp,// 清空按钮
        $maskLayer,
        $cleanUpPopupWindow,// 清除按钮对应的居中弹出框
        $cleanUpPWConfirm,// 弹窗的“确定”按钮
        $cleanUpPWCancel,// 弹窗的“取消”按钮
        $btnSlider,// 作用点滑块开关
        $sliderRegion;

    var pIdx = -1,
        fIdx = -1,
        preHandledObj = null,// 记录之前被操作的对象
        possessActionPoint = true;// 标识力是否有作用点 true：有作用点，false：无作用点

    /**
     * 视图控件初始化
     */
    var findView = function () {
        $traverseParent = $("div._traverseParent");
        $panel = $traverseParent.find("div._panel");
        $btnDrawFP = $traverseParent.find("a._drawFPBtn");
        $btnDrawF = $traverseParent.find("a._drawFBtn");
        $btnFCompound = $traverseParent.find("a._compoundBtn");
        $btnFDecompose = $traverseParent.find("a._decomposeBtn");

        $btnUndo = $traverseParent.find("a._undoBtn");// 撤销
        $btnRedo = $traverseParent.find("a._redoBtn");// 还原
        $btnCleanUp = $traverseParent.find("a._clearUpBtn");

        $btnSlider = $traverseParent.find("b._sliderCheckBox");
        $sliderRegion = $traverseParent.find("li._sliderRegion");

        // 清空弹窗
        $maskLayer = $traverseParent.find("div._mask_layer");
        $cleanUpPopupWindow = $traverseParent.find("div._cleanUpPopupWindow");
        $cleanUpPWConfirm = $traverseParent.find("a._cleanUpConfirmBtn");
        $cleanUpPWCancel = $traverseParent.find("a._cleanUpCancelBtn");
        $cleanUpPopupWindow.hide();

        // 合成弹窗
        $compoundPopupWindow = $traverseParent.find("div._compoundPopupWindow");
        $compoundPWConfirm = $traverseParent.find("a._compoundConfirmBtn");
        $compoundPWCancel = $traverseParent.find("a._compoundCancelBtn");
        $compoundFMarkedSpan = $traverseParent.find("b._fCompoundNum");
        $compoundPopupWindow.hide();

        // 分解弹窗
        $decomposePopupWindow = $traverseParent.find("div._decomposePopupWindow");
        $decomposeFMarkedSpan = $traverseParent.find("b._fDecomposeNum");
        $decomposePWCancel = $traverseParent.find("a._decomposeCancelBtn");
        $decomposePWConfirm = $traverseParent.find("a._decomposeConfirmBtn");
        $decomposePopupWindow.hide();

        $panel.css({
            "cursor": "pointer"//设置鼠标进入面板样式
        });
    };

    /**
     * 状态机,标识当前面板处于的状态 以及状态的切换
     */
    var STATE = {
            CAN_DRAW_FP: 0,//可绘制作用点
            CAN_DRAW_F: 1,//可绘制力
            CAN_DO_FC: 2,//可合成力
            CAN_DO_FD: 3,//可分解力
            IDLE: -1//面板闲置
        },
        currentPanelState = STATE.IDLE;// 标识面板当前的状态

    /**
     * 场景类型
     */
    var SCENE_TYPE = {
        FC: 1,// 合成场景
        FD: -1//分解场景
    };

    var COLOR = ["color_force_red", "color_force_green", "color_force_yellow", "color_force_purple"];

    /**
     * 业务类方法集合
     */
    var PhysicsSynthesis = {
        cleanUpPanel: function () {// 清空面板
            if ($cleanUpPopupWindow) {
                $cleanUpPopupWindow.hide();
            }
            if ($maskLayer.hasClass("show")) {
                $maskLayer.removeClass("show");
            }
            if (panelContainer && panelContainer.size()) {
                // 可以清空
                pIdx = -1;
                fIdx = -1;
                var point;
                while (panelContainer.size()) {
                    point = panelContainer._array.shift();
                    if (point) {
                        point.structurallyDestroy();
                    }
                }
            }
            // 重置容器对象
            if (undoStack && undoStack._array.length) {
                undoStack.empty();
            }
            if (redoStack && redoStack._array.length) {
                redoStack.empty();
            }
            if (cdQ && cdQ._array.length) {
                cdQ.empty();
            }
            if(pIdxContainer) {
              pIdxContainer.empty();
            }
            if(fIdxContainer) {
              fIdxContainer.empty();
            }
            Consult.askMeetCleanUPCondition();
            Consult.askMeetFCFDCondition();
        },
        doFCompound: function (concurrentForces) {
            if (concurrentForces && concurrentForces.length > 1) {// 至少有两个合力
                var f1,
                    f2,
                    fCompound,
                    fCompoundData,
                    fc_x,
                    fc_y,
                    dashLine1,
                    dashLine2,
                    attrDashLine1,
                    attrDashLine2,
                    scene,// 场景对象
                    compoundScene = {};// 记录用户的一次合成操作

                // 先判断作用点是否已经有场景了
                if (concurrentForces[0].actionPoint) {
                    if (concurrentForces[0].actionPoint.scene) {
                        compoundScene.destroyedScene = concurrentForces[0].actionPoint.scene;
                        concurrentForces[0].actionPoint.scene.logicallyDestroy();
                    }
                }

                // 退出编辑态
                if (concurrentForces[0].actionPoint) {
                    if (concurrentForces[0].actionPoint.isShowForceTipsBox) {
                        concurrentForces[0].actionPoint._toggleForceTipsBox();
                    }
                }

                // 作用点绑定场景信息
                scene = new Scene({
                    associatedPoint: concurrentForces[0].actionPoint,
                    type: SCENE_TYPE.FC
                });
                scene.associatedPoint.bindScene(scene);

                compoundScene.scene = scene;

                while (concurrentForces.length > 1) {
                    f1 = concurrentForces.shift();
                    f2 = concurrentForces.shift();

                    // 退出编辑态
                    if (f1.isShowForceTipsBox) {
                        f1._toggleForceTipsBox();
                    }
                    if (f2.isShowForceTipsBox) {
                        f2._toggleForceTipsBox();
                    }

                    // 非选中状态
                    if (f1.isSelected) {
                        f1._toggleFSelectState();
                    }
                    if (f2.isSelected) {
                        f2._toggleFSelectState();
                    }

                    // 生成一个合成场景

                    //生成合力
                    fc_x = f1.x2 + f2.x2 - f2.x1;
                    fc_y = f1.y2 + f2.y2 - f2.y1;
                    fCompoundData = {
                        x1: f2.x1,
                        y1: f2.y1,
                        x2: fc_x,
                        y2: fc_y,
                        color: "color_force_red",
                        panel: $panel,
                        isCompound: true,//标志为合力
                        isAssistant: true // 标志为辅助力
                    };
                    if (concurrentForces.length == 0) {// 为合力
                        fCompoundData.isDotted = false;
                        fCompoundData.nameChar = "F合";
                    } else {// 为临时的合力
                        fCompoundData.isDotted = true;
                        if (++fIdx == 0) {
                            fCompoundData.nameChar = "F";
                        } else {
                            fCompoundData.nameChar = "F" + fIdx;
                        }
                    }
                    fCompound = new F(fCompoundData);
                    if (concurrentForces.length != 0) {// 不是最终合力
                      fCompound.setIdx(fIdx);
                      fIdxContainer.add(fIdx);
                    }
                    concurrentForces.unshift(fCompound);

                    // 生成辅助线
                    attrDashLine1 = {
                        x1: f1.x2,
                        y1: f1.y2,
                        x2: fc_x,
                        y2: fc_y
                    };
                    attrDashLine2 = {
                        x1: f2.x2,
                        y1: f2.y2,
                        x2: fc_x,
                        y2: fc_y
                    };
                    if (concurrentForces.length == 1) {// 为合力
                        attrDashLine1.isTranslucent = false;
                        attrDashLine2.isTranslucent = false;
                    }
                    dashLine1 = new DashLine(attrDashLine1);
                    dashLine2 = new DashLine(attrDashLine2);

                    // 记录合力信息
                    scene.recordJoinForce(fCompound);
                    // 记录辅助线
                    scene.recordAuxiliaryLine(dashLine1);
                    scene.recordAuxiliaryLine(dashLine2);
                }
                return compoundScene;
            } else {
                // 切换回未选中状态
                if (concurrentForces[0].isSelected) concurrentForces[0]._toggleFSelectState();
                // 退出编辑态
                if (concurrentForces[0].isShowForceTipsBox) {
                    concurrentForces[0]._toggleForceTipsBox();
                }
                if (concurrentForces[0].actionPoint) {
                    if (concurrentForces[0].actionPoint.isShowForceTipsBox) {
                        concurrentForces[0].actionPoint._toggleForceTipsBox();
                    }
                }
                return null;
            }
        },
        doFDecompose: function (concurrentForces) {
            if (concurrentForces && concurrentForces.length) {
                var fCompound,// 待分解的合力
                    attrCoordinates,// 坐标轴
                    coordinates,
                    f1,//两个分力
                    f1Data,
                    f2,
                    f2Data,
                    dashLine1,// 两条辅助线
                    attrDashLine1,
                    dashLine2,
                    attrDashLine2,
                    scene,// 场景对象
                    clrIdx = -1,// 颜色下标
                    xPositiveLenMax = 50,//设置坐标轴的长度
                    xNegativeLenMax = 50,
                    yPositiveLenMax = 50,
                    yNegativeLenMax = 50,
                    currentXPositiveLen,
                    currentYPositiveLen,
                    currentXReverseLen,
                    currentYReverseLen,
                    decomposeScene = {};// 记录用户的一次合成操作

                // 先判断作用点是否已经有场景了
                if (concurrentForces[0].actionPoint) {
                    if (concurrentForces[0].actionPoint.scene) {
                        decomposeScene.destroyedScene = concurrentForces[0].actionPoint.scene;
                        concurrentForces[0].actionPoint.scene.logicallyDestroy();
                    }
                }

                // 作用点退出编辑态
                if (concurrentForces[0].actionPoint) {
                    if (concurrentForces[0].actionPoint.isShowForceTipsBox) {
                        concurrentForces[0].actionPoint._toggleForceTipsBox();
                    }
                }

                // 绑定场景信息
                scene = new Scene({
                    associatedPoint: concurrentForces[0].actionPoint,
                    type: SCENE_TYPE.FD
                });
                concurrentForces[0].actionPoint.bindScene(scene);

                decomposeScene.scene = scene;

                while (concurrentForces.length) {
                    // 取出一种颜色
                    if (++clrIdx > COLOR.length - 1) {
                        clrIdx = 0;
                    }

                    // 取出合力
                    fCompound = concurrentForces.shift();

                    // 合力切换为非选中状态
                    if (fCompound.isSelected) {
                        fCompound._toggleFSelectState();
                    }
                    if (fCompound.isShowForceTipsBox) {
                        fCompound._toggleForceTipsBox();
                    }

                    // 过滤特殊情况
                    if (fCompound.x1 == fCompound.x2) {// 垂直情况
                        return;
                    }
                    if (fCompound.y1 == fCompound.y2) {// 水平情况
                        return;
                    }

                    //生成分力
                    f1Data = {
                        x1: fCompound.x1,
                        y1: fCompound.y1,
                        x2: fCompound.x2,
                        y2: fCompound.y1,
                        nameChar: fCompound.nameChar + "'",
                        color: COLOR[clrIdx],
                        panel: $panel,
                        isAssistant: true // 标志为辅助力
                    };
                    f2Data = {
                        x1: fCompound.x1,
                        y1: fCompound.y1,
                        x2: fCompound.x1,
                        y2: fCompound.y2,
                        nameChar: fCompound.nameChar + "''",
                        color: COLOR[clrIdx],
                        panel: $panel,
                        isAssistant: true // 标志为辅助力
                    };
                    f1 = new F(f1Data);
                    f2 = new F(f2Data);

                    // 生成坐标轴
                    if (!coordinates) {
                        attrCoordinates = {
                            x: fCompound.x1,
                            y: fCompound.y1,
                            xPositiveLen: xPositiveLenMax,
                            xNegativeLen: xNegativeLenMax,
                            yPositiveLen: yPositiveLenMax,
                            yNegativeLen: yNegativeLenMax
                        };
                        coordinates = new Coordinates(attrCoordinates);
                    }

                    // 设置坐标轴的四个方向值
                    if (fCompound.x1 < fCompound.x2 && fCompound.y1 > fCompound.y2) {
                        currentXPositiveLen = Utils.calDistance(f1.x1, f1.y1, f1.x2, f1.y2) + 50;
                        currentYPositiveLen = Utils.calDistance(f2.x1, f2.y1, f2.x2, f2.y2) + 50;
                        if (xPositiveLenMax < currentXPositiveLen) {
                            xPositiveLenMax = currentXPositiveLen;
                        }
                        if (yPositiveLenMax < currentYPositiveLen) {
                            yPositiveLenMax = currentYPositiveLen;
                        }
                        coordinates.setXPositiveLen(xPositiveLenMax);
                        coordinates.setYPositiveLen(yPositiveLenMax);
                    }
                    if (fCompound.x1 > fCompound.x2 && fCompound.y1 < fCompound.y2) {
                        currentXReverseLen = Utils.calDistance(f1.x1, f1.y1, f1.x2, f1.y2) + 50;
                        currentYReverseLen = Utils.calDistance(f2.x1, f2.y1, f2.x2, f2.y2) + 50;
                        if (xNegativeLenMax < currentXReverseLen) {
                            xNegativeLenMax = currentXReverseLen;
                        }
                        if (yNegativeLenMax < currentYReverseLen) {
                            yNegativeLenMax = currentYReverseLen;
                        }
                        coordinates.setXReverseLen(xNegativeLenMax);
                        coordinates.setYReverseLen(yNegativeLenMax);
                    }
                    if (fCompound.x1 < fCompound.x2 && fCompound.y1 < fCompound.y2) {
                        currentXPositiveLen = Utils.calDistance(f1.x1, f1.y1, f1.x2, f1.y2) + 50;
                        currentYReverseLen = Utils.calDistance(f2.x1, f2.y1, f2.x2, f2.y2) + 50;
                        if (xPositiveLenMax < currentXPositiveLen) {
                            xPositiveLenMax = currentXPositiveLen;
                        }
                        if (yNegativeLenMax < currentYReverseLen) {
                            yNegativeLenMax = currentYReverseLen;
                        }
                        coordinates.setXPositiveLen(xPositiveLenMax);
                        coordinates.setYReverseLen(yNegativeLenMax);
                    }
                    if (fCompound.x1 > fCompound.x2 && fCompound.y1 > fCompound.y2) {
                        currentXReverseLen = Utils.calDistance(f1.x1, f1.y1, f1.x2, f1.y2) + 50;
                        currentYPositiveLen = Utils.calDistance(f2.x1, f2.y1, f2.x2, f2.y2) + 50;
                        if (xNegativeLenMax < currentXReverseLen) {
                            xNegativeLenMax = currentXReverseLen;
                        }
                        if (yPositiveLenMax < currentYPositiveLen) {
                            yPositiveLenMax = currentYPositiveLen;
                        }
                        coordinates.setXReverseLen(xNegativeLenMax);
                        coordinates.setYPositiveLen(yPositiveLenMax);
                    }

                    // 生成辅助线
                    attrDashLine1 = {
                        x1: fCompound.x1,
                        y1: fCompound.y2,
                        x2: fCompound.x2,
                        y2: fCompound.y2,
                        color: COLOR[clrIdx]
                    };
                    attrDashLine2 = {
                        x1: fCompound.x2,
                        y1: fCompound.y1,
                        x2: fCompound.x2,
                        y2: fCompound.y2,
                        color: COLOR[clrIdx]
                    };
                    dashLine1 = new DashLine(attrDashLine1);
                    dashLine2 = new DashLine(attrDashLine2);

                    // 记录分力
                    scene.recordComponentForce(f1);
                    scene.recordComponentForce(f2);
                    // 记录辅助线
                    scene.recordAuxiliaryLine(dashLine1);
                    scene.recordAuxiliaryLine(dashLine2);
                    // 记录坐标轴
                    scene.recordCoordinates(coordinates);
                }
                return decomposeScene;
            }
            return null;
        }
    };

    /**
     * 咨询性质方法集合
     */
    var Consult = {
        askMeetFCFDCondition: function () {// 咨询是否达到 合成 || 分解 力的条件
            var fCNum = 0,
                canDoFC = false,
                canDoFD = false,
                size;
            if (panelContainer && (size = panelContainer.size())) {
                for (var i = 0; i < size; i++) {
                    var point = panelContainer._array[i];
                    if (point) {
                        if (point.isVirtual) {// 找到一个无作用点的力
                            canDoFD = true;
                        } else {// 非虚拟作用点
                            var len;
                            if (point._concurrentForces && (len = point._concurrentForces.length)) {
                                var concurrentForce;
                                fCNum = 0;
                                for (var j = 0; j < len; j++) {
                                    concurrentForce = point._concurrentForces[j];
                                    if (!concurrentForce._beenLogicallyDestroyed) {
                                        fCNum++;
                                    }
                                    if (!canDoFD && fCNum >= 1) {
                                        canDoFD = true;
                                    }
                                    if (!canDoFC && fCNum >= 2) {
                                        canDoFC = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (canDoFC) {
                        break;
                    }
                }
            }
            if (canDoFC) {
                Utils.set2GreyState($btnFCompound, false);
            } else {
                Utils.set2GreyState($btnFCompound, true);
                $compoundPopupWindow.hide();
            }
            if (canDoFD) {
                Utils.set2GreyState($btnFDecompose, false);
            } else {
                Utils.set2GreyState($btnFDecompose, true);
                $decomposePopupWindow.hide();
            }
        },
        askMeetCleanUPCondition: function () {// 咨询是否满足　清空面板内容　条件
            (panelContainer && panelContainer.size()) ? Utils.set2GreyState($btnCleanUp, false) : Utils.set2GreyState($btnCleanUp, true);
        },
        askMeetReUnDoCondition: function () {// 咨询是否满足 撤销 || 恢复 的条件
            (undoStack && undoStack._array.length) ? Utils.set2GreyState($btnUndo, false) : Utils.set2GreyState($btnUndo, true);
            (redoStack && redoStack._array.length) ? Utils.set2GreyState($btnRedo, false) : Utils.set2GreyState($btnRedo, true);
        },
        updateFCFDPopupWindow: function () {// update 合成 || 分解 弹出框面板
            // 统计弹框面板数据
            var canDoFC = false;
            var canDoFD = false;
            var fNum = 0;// 统计cdQ容器力的数量
            var concurrentForceNum = 0;// 统计共点力数量

            // 判断是否达到合成、分解条件 and 统计力、共点力数量
            var size = cdQ.size();
            if (cdQ && size) {
                canDoFD = true;
                for (var i = 0; i < size; i++) {
                    if (!canDoFC) {
                        if (cdQ._array[i].length >= 2) {
                            canDoFC = true;
                        }
                    }
                    fNum += cdQ._array[i].length;
                    // 共点力统计排除无作用点情况
                    if (cdQ._array[i].length == 1 && !cdQ._array[i][0].isPossessActionPoint) {
                        concurrentForceNum++;
                    }
                }
                concurrentForceNum = fNum - concurrentForceNum;
            }

            //更新合成弹出框面板
            Utils.setText($compoundFMarkedSpan, concurrentForceNum);
            if (canDoFC) {
                Utils.set2CorrectState($compoundFMarkedSpan, true);
                Utils.set2GreyState($compoundPWConfirm, false);
            } else {
                Utils.set2CorrectState($compoundFMarkedSpan, false);
                Utils.set2GreyState($compoundPWConfirm, true);
            }

            //更新分解弹出框面板
            Utils.setText($decomposeFMarkedSpan, fNum);
            if (canDoFD) {
                Utils.set2CorrectState($decomposeFMarkedSpan, true);
                Utils.set2GreyState($decomposePWConfirm, false);
            } else {
                Utils.set2CorrectState($decomposeFMarkedSpan, false);
                Utils.set2GreyState($decomposePWConfirm, true);
            }
        }
    };


    /**
     * 清除之前的面板状态
     * @param preState 上一个面板状态
     */
    var cleanPrePanelState = function (preState) {//清除之前的面板状态
        switch (preState) {
            case STATE.CAN_DRAW_FP:
                Utils.set2ActiveState($btnDrawFP, false);
                break;
            case STATE.CAN_DRAW_F:
                Utils.set2ActiveState($btnDrawF, false);
                break;
            case STATE.CAN_DO_FC:
                Utils.set2ActiveState($btnFCompound, false);
                $compoundPopupWindow.hide();
                break;
            case STATE.CAN_DO_FD:
                Utils.set2ActiveState($btnFDecompose, false);
                $decomposePopupWindow.hide();
                break;
        }
    };

    /**
     * 面板状态切换逻辑
     * @param state 要切换的面板状态
     */
    var switchState = function (state) {
        if (preHandledObj) {
            preHandledObj._toggleForceTipsBox();
        }
        cleanPrePanelState(currentPanelState);//清除前一次的面板状态
        if (state == currentPanelState) {//连续两次点击同一个按钮，则关闭该状态
            currentPanelState = STATE.IDLE;
            currentPanelState == STATE.CAN_DRAW_F ? Utils.set2GreyState($sliderRegion, false) : Utils.set2GreyState($sliderRegion, true);
            return;
        }
        switch (state) {//切换状态
            case STATE.CAN_DRAW_FP:
                Utils.set2ActiveState($btnDrawFP, true);
                break;
            case STATE.CAN_DRAW_F:
                Utils.set2ActiveState($btnDrawF, true);
                break;
            case STATE.CAN_DO_FC:
                Utils.set2ActiveState($btnFCompound, true);
                $compoundPopupWindow.show();
                break;
            case STATE.CAN_DO_FD:
                Utils.set2ActiveState($btnFDecompose, true);
                $decomposePopupWindow.show();
                break;
        }
        currentPanelState = state;
        currentPanelState == STATE.CAN_DRAW_F ? Utils.set2GreyState($sliderRegion, false) : Utils.set2GreyState($sliderRegion, true);
    };

    /**
     * 面板容器
     * @param obj
     * @returns {*}
     */
    // 容器的声明
    var panelContainer,// 面板容器对象
        redoStack,
        undoStack,
        fIdxContainer,
        pIdxContainer,
        cdQ;// 力的合成分解队列
    var init = function () {
        PANEL_BORDER.BOTTOM = $panel.height() - 15;
        PANEL_BORDER.RIGHT = $panel.width() - 15;
        PANEL_BORDER.LEFT = 15;
        PANEL_BORDER.TOP = 15;

        Array.prototype.deletePhysicsSynthesisObj = function (obj) {// 根据删除对象
            var size = this.length;
            if (size) {
                for (var j = 0; j < size; j++) {
                    if (this[j].getId() == obj.getId()) {// 在面板容器中找到该对象的记录
                        return this.splice(j, 1);
                    }
                }
            }
            // 没有找到该对象的记录
            return -1;
        };

        possessActionPoint = true;

        PhysicsSynthesis.cleanUpPanel();
        switchState(currentPanelState);

        fIdxContainer = {
          _array:[],
          add: function(idx) {
            this._array.push(idx);
            this._array.sort(function(a,b){
              return a-b;
            });
            this._reSetFIdx();
            // console.group("fIdx");
            // console.log(fIdx);
            // console.log(this._array);
            // console.groupEnd();
          },
          remove: function(idx) {
            var existIdx = -1;
            for(var k = 0;k < this._array.length;++k) {
              if(this._array[k] == idx) {
                existIdx = k;
                break;
              }
            }
            if(existIdx != -1) {
              this._array.splice(k,1);
            }
            this._reSetFIdx();
            // console.group("fIdx");
            // console.log(fIdx);
            // console.log(this._array);
            // console.groupEnd();
          },
          _reSetFIdx: function() {
            var len = this._array.length;
            if(len === 0) {
              fIdx = -1;
            }else {
              fIdx = this._array[len-1];
            }
          },
          empty: function() {
            this._array.length = 0;
            this._reSetFIdx();
            // console.group("fIdx");
            // console.log(fIdx);
            // console.log(this._array);
            // console.groupEnd();
          }
        };

        pIdxContainer = {
          _array:[],
          add: function(idx) {
            this._array.push(idx);
            this._array.sort(function(a,b){
              return a-b;
            });
            this._reSetPIdx();
            // console.group("pIdx");
            // console.log(pIdx);
            // console.log(this._array);
            // console.groupEnd();
          },
          remove: function(idx) {
            var existIdx = -1;
            for(var k = 0;k < this._array.length;++k) {
              if(this._array[k] == idx) {
                existIdx = k;
                break;
              }
            }
            if(existIdx != -1) {
              this._array.splice(k,1);
            }
            this._reSetPIdx();
            // console.group("pIdx");
            // console.log(pIdx);
            // console.log(this._array);
            // console.groupEnd();
          },
          _reSetPIdx: function() {
            var len = this._array.length;
            if(len === 0) {
              pIdx = -1;
            }else {
              pIdx = this._array[len-1];
            }
          },
          empty: function() {
            this._array.length = 0;
            this._reSetPIdx();
            // console.group("pIdx");
            // console.log(pIdx);
            // console.log(this._array);
            // console.groupEnd();
          }
        };

        // 初始化恢复栈
        redoStack = {
            _array: [],
            pushStack: function (obj) {// 入栈
                if (this._array.length == 10) {// 控制只能撤销10步
                    this._array.splice(-1, 1);
                }
                this._array.unshift(obj);
                Consult.askMeetReUnDoCondition();
            },
            popStack: function () {// 抛栈
                var returnObj = this._array.shift();
                Consult.askMeetReUnDoCondition();
                return returnObj;
            },
            empty: function () {
                this._array.length = 0;
                Consult.askMeetReUnDoCondition();
            }
        };
        undoStack = {
            _array: [],
            pushStack: function (obj) {// 入栈
                if (this._array.length == 10) {// 控制只能撤销10步
                    this._array.splice(-1, 1);
                }
                this._array.unshift(obj);
                Consult.askMeetReUnDoCondition();
            },
            popStack: function () {// 抛栈
                var returnObj = this._array.shift();
                Consult.askMeetReUnDoCondition();
                return returnObj;
            },
            empty: function () {
                this._array.length = 0;
                Consult.askMeetReUnDoCondition();
            }
        };
        panelContainer = {// 面板容器单例 ——> 只是添加共点力作用点对象(包括虚拟作用点)
            _array: [],
            size: function () {
                return this._array.length;
            },
            remove: function (obj) {
                if (obj instanceof FPoint) {
                    var result = this._array.deletePhysicsSynthesisObj(obj);
                    // 咨询是否达到 合成 || 分解 条件
                    Consult.askMeetFCFDCondition();
                    Consult.askMeetCleanUPCondition();
                    return result != -1;// true：对象删除成功 false：面板容器没有该对象记录
                }
                throw new Error("Error Info：类型不对，待删除的对象不是作用点");
            },
            add: function (obj) {
                if (obj instanceof FPoint) {
                    this._array.push(obj);
                    // 咨询是否达到 合成 || 分解 条件
                    Consult.askMeetFCFDCondition();
                    Consult.askMeetCleanUPCondition();
                    return true;
                }
                throw new Error("Error Info：类型不对，待添加的对象不是作用点");
            }
        };

        cdQ = {// 力的合成分解队列，点击力就会被加入到队列中
            _array: [],
            size: function () {
                return this._array.length;
            },
            empty: function () {
                this._array.length = 0;
                Consult.updateFCFDPopupWindow();
            },
            enQueue: function (obj) {// 入队列
                var enQueueSuccess = false;
                if (this._array.length) {
                    for (var i = 0; i < this._array.length; i++) {
                        if (this._array[i][0].actionPoint.getId() == obj.actionPoint.getId()) {
                            this._array[i].push(obj);
                            enQueueSuccess = true;
                            break;
                        }
                    }
                    if (!enQueueSuccess) {
                        var nextNode = [];
                        nextNode.push(obj);
                        this._array.push(nextNode);
                    }
                }
                if (this._array.length == 0) {
                    var headNode = [];
                    headNode.push(obj);
                    this._array.push(headNode);
                }
                Consult.updateFCFDPopupWindow();
            },
            deQueue: function () {// 出队列
                return this._array.shift();
            },
            remove: function (obj) {
                for (var i = 0; i < this._array.length; i++) {
                    for (var j = 0; j < this._array[i].length; j++) {
                        if (this._array[i][j].getId() == obj.getId()) {
                            this._array[i].deletePhysicsSynthesisObj(obj);
                            if (this._array[i].length == 0) {
                                this._array.splice(i, 1);
                            }
                            break;
                        }
                    }
                }
                Consult.updateFCFDPopupWindow();
            }
        };
    };

    // 消息处理中心，每一次消息都代表用户的一次新操作
    var MESSAGE = {
        NO_NEED_POST: false,// 不需要发送消息
        NEED_POST: true,// 需要发送消息
        ADD_POINT: 1,// 只是添加了一个作用点
        ADD_FORCE_WITH_POINT: 2,// 添加了一个有作用点的力
        ADD_CONCURRENT_FORCE: 3,// 添加一个共点力
        DROP_CONCURRENT_FORCE: 4,// 删除一个共点力
        DROP_NON_CONCURRENT_FORCE: 5,// 删除一个非共点力
        DROP_POINT: 6,// 删除了一个作用点
        TRANSLATE_POINT: 7,// 平移作用点
        DRAG_FORCE: 8,// 拖拽力
        RENAME_OBJ: 9,// 重命名
        COMPOUND_FORCES: 10,// 合成
        DECOMPOSE_FORCES: 11// 分解
    };

    var handler = {
        sendMessage: function (msg) {
            this._dispatchMessage(msg);
        },
        _dispatchMessage: function (msg) {
            switch (msg.identify) {
                case MESSAGE.ADD_POINT:// 只是添加了一个作用点
                    panelContainer.add(msg.target);
                    undoStack.pushStack({
                        description: "创建了一个作用点",
                        doWhat: MESSAGE.ADD_POINT,
                        actionObj: msg.target
                    });
                    break;
                case MESSAGE.ADD_FORCE_WITH_POINT:// 添加了一个有作用点的力
                    panelContainer.add(msg.target.actionPoint);
                    undoStack.pushStack({
                        doWhat: MESSAGE.ADD_FORCE_WITH_POINT,
                        actionObj: msg.target,
                        description: possessActionPoint ? "创建了一个带作用点的力" : "创建了一个不！！！带作用点的力"
                    });
                    break;
                case MESSAGE.ADD_CONCURRENT_FORCE:// 创建了一个共点力
                    undoStack.pushStack({
                        description: "创建了一个共点力",
                        doWhat: MESSAGE.ADD_CONCURRENT_FORCE,
                        actionObj: msg.target
                    });
                    break;
                case MESSAGE.DROP_CONCURRENT_FORCE:// 删除一个共点力
                    undoStack.pushStack({
                        description: "删除了一个共点力",
                        doWhat: MESSAGE.DROP_CONCURRENT_FORCE,
                        actionObj: msg.target,
                        destroyedScene: msg.destroyedScene
                    });
                    break;
                case MESSAGE.DROP_NON_CONCURRENT_FORCE:// 删除一个非共点力(没有作用点的力)
                    panelContainer.remove(msg.target);
                    undoStack.pushStack({
                        description: "删除了一个无作用点的力",
                        doWhat: MESSAGE.DROP_NON_CONCURRENT_FORCE,
                        actionObj: msg.target,
                        destroyedScene: msg.target.scene
                    });
                    break;
                case MESSAGE.DROP_POINT:// 删除一个作用点
                    panelContainer.remove(msg.target);
                    undoStack.pushStack({
                        description: "删除了一个作用点",
                        doWhat: MESSAGE.DROP_POINT,
                        actionObj: msg.target,
                        destroyedScene: msg.target.scene
                    });
                    break;
                case MESSAGE.RENAME_OBJ:// 重命名
                    undoStack.pushStack({
                        description: "修改了名字",
                        doWhat: MESSAGE.RENAME_OBJ,
                        actionObj: msg.target,
                        preState: msg.preState
                    });
                    break;
                case MESSAGE.DRAG_FORCE:
                    undoStack.pushStack({
                        description: "拖拽了一个力",
                        doWhat: MESSAGE.DRAG_FORCE,
                        actionObj: msg.target,
                        preState: msg.preState,
                        destroyedScene: msg.destroyedScene
                    });
                    break;
                case MESSAGE.TRANSLATE_POINT:
                    undoStack.pushStack({
                        description: "平移了作用点",
                        doWhat: MESSAGE.TRANSLATE_POINT,
                        actionObj: msg.target,
                        preState: msg.preState
                    });
                    break;
                case MESSAGE.COMPOUND_FORCES:
                    undoStack.pushStack({// 合成同时是否销毁了场景
                        description: "执行一次合成",
                        doWhat: MESSAGE.COMPOUND_FORCES,
                        scenes: msg.scenes
                    });
                    break;
                case MESSAGE.DECOMPOSE_FORCES:
                    // 记录用户的一次合成操作
                    undoStack.pushStack({// 分解的同时是否销毁了场景
                        description: "执行一次分解",
                        doWhat: MESSAGE.DECOMPOSE_FORCES,
                        scenes: msg.scenes
                    });
                    break;
            }

            // 清空redoStack
            redoStack.empty();
            Consult.askMeetFCFDCondition();
        }
    };

    /**
     * 模型的定义
     */

    // 1、力
    function F(attrData) {
        // 标识力对象的唯一ID
        this.id = Utils.getCurrentTimeMillis();

        // 头尾坐标
        this.x1 = attrData.x1 || 300;
        this.y1 = attrData.y1 || 300;
        this.x2 = attrData.x2 || 600;
        this.y2 = attrData.y2 || 600;

        this.idx = undefined;
        this.nameChar = attrData.nameChar || "F";

        // 记录该力所被添加的面板
        this.$panel = attrData.panel || $panel;

        // 力关联的作用点句柄
        this.actionPoint = null;

        // 样式控制标志位
        this.isThin = attrData.isThin || false;// 标识是否是细力
        this.isDotted = attrData.isDotted || false;// 标识是否是虚线力
        this.color = attrData.color || null;// 标识力的颜色

        // 逻辑控制标志位
        this.isPossessActionPoint = attrData.isPossessActionPoint || true;// 标识有无作用点，true：有作用点，false：无作用点
        this.isSelected = false;// 表示是否被选中
        this.isShowForceTipsBox = false;// 标识是否显示力的确定删除框
        this.isAssistant = attrData.isAssistant || false;// false(default)：为用户画的力 true：辅助力(没有编辑态)
        this.isCompound = attrData.isCompound || false;

        this._beenLogicallyDestroyed = false;// 是否被逻辑上删除

        this.scene = null;

        // 视图
        this.view = {};

        // 绘制力的视图
        this._draw();
    }

    F.prototype = {
        getId: function () {
          return this.id;
        },
        getIdx: function() {
          return this.idx;
        },
        setIdx: function(idx) {
          this.idx = idx;
        },
        _initView: function () {// 初始化View，只会执行一次
            // 创建力的各个部件
            this.view.$ph_force = $('<div class="ph_force" style="z-index:20;width:300px;transform: rotate(0deg);left:297px; top:298px;"></div>');// ph_force_on || dotted_line || force_thin
            this.view.$force_line = $('<div class="force_line hand_type"></div>');
            this.view.$force_arrow = $('<div class="force_arrow iconfont"><span class="icon_jt">&#xe613;</span></div>');
            this.view.$force_name_box = $('<div class="force_name_box" style="transform: rotate(0deg)"></div>');
            this.view.$force_name_input = $('<input class="force_name" name="" type="text" />');// display:none || block
            this.view.$force_name_span = $('<span class="force_name"></span>');
            this.view.$force_tips_box = $('<div class="force_tips_box"></div>');// box_show
            this.view.$tips_delete = $('<a class="tips_delete" href="javascript:;">删除</a>');
            this.view.$tips_ok = $('<a class="tips_ok" href="javascript:;">确定</a>');
            this.view.$force_drag = $('<div class="force_drag"></div>');// drag_on

            // 组装控件
            this.view.$force_tips_box.append(this.view.$tips_delete);// 组装确定删除框控件
            this.view.$force_tips_box.append(this.view.$tips_ok);
            this.view.$force_name_box.append(this.view.$force_name_input);// 组装力名字控件
            this.view.$force_name_box.append(this.view.$force_name_span);
            this.view.$force_name_box.append(this.view.$force_tips_box);
            this.view.$ph_force.append(this.view.$force_line);// 组装力控件
            this.view.$ph_force.append(this.view.$force_arrow);
            this.view.$ph_force.append(this.view.$force_name_box);

            // 把力的视图添加到面板中
            this.$panel.append(this.view.$ph_force);
            this.$panel.append(this.view.$force_drag);

            // 设置是否是细力
            if (this.isThin) {
                this.view.$ph_force.addClass("force_thin");
            }

            // 设置是否是虚线力
            if (this.isDotted) {
                this.view.$ph_force.addClass("dotted_line");
            }

            // 设置为合力
            if (this.isCompound) {
                this.view.$ph_force.addClass("ph_force_merge");
            }

            // 有传递color值
            if (this.color) {
                this.view.$ph_force.addClass(this.color);
            }

            // 设置名字
            this.view.$force_name_span.html(this.nameChar);
            this.view.$force_name_input.val(this.nameChar);

            var degree = Utils.calDegree(this.x1, this.y1, this.x2, this.y2);
            this.view.$ph_force.css({
                "left": this.x1,// 设置偏移位置
                "top": this.y1 - this.view.$ph_force.height() / 2,
                "width": Utils.calDistance(this.x1, this.y1, this.x2, this.y2),// 计算长度
                "transform": "rotate(" + degree + "deg)"// 计算旋转角度
            });
            this.view.$force_name_box.css("transform", "rotate(" + -degree + "deg)");

            // 定位force_drag
            // 设置偏移位置
            this.view.$force_drag.css({
                "left": this.x2,
                "top": this.y2 - this.view.$ph_force.height() / 2
            });

            if (this.x1 > this.x2) {
                this.view.$force_name_box.addClass("reverse_force_name_box");
            }
        },
        _toggleFSelectState: function () {
            // 标志位的切换
            this.isSelected = !this.isSelected;

            // 选中状态的切换
            if (this.isSelected) {
                this.view.$ph_force.addClass("ph_force_on");
                this.view.$force_drag.addClass("drag_show");
                if (!this.isPossessActionPoint) {// 需要显示虚拟作用点
                    this.actionPoint.hideSelf(false);
                }
                cdQ.enQueue(this);
            } else {
                if (this.view.$ph_force.hasClass("ph_force_on")) {
                    this.view.$ph_force.removeClass("ph_force_on");
                    this.view.$force_drag.removeClass("drag_show");
                }
                if (!this.isPossessActionPoint) {// 需要隐藏虚拟作用点
                    this.actionPoint.hideSelf(true);
                }
                cdQ.remove(this);
            }
        },
        _toggleForceTipsBox: function () {
            this.isShowForceTipsBox = !this.isShowForceTipsBox;
            if (this.isShowForceTipsBox) {
                this.view.$force_name_input.val(this.nameChar);
                this.view.$force_name_box.addClass("name_edit");
                this.view.$force_name_input.focus();
                preHandledObj = this;
                this.view.$ph_force.addClass("z_index_top");
                this.actionPoint.view.$force_circle.addClass("point_z_index_top");
            } else {
                if (this.view.$force_name_box.hasClass("name_edit")) {
                    this.view.$force_name_box.removeClass("name_edit");
                }
                preHandledObj = null;
                if (this.view.$ph_force.hasClass("z_index_top")) {
                    this.view.$ph_force.removeClass("z_index_top");
                }
                if (this.actionPoint.view.$force_circle.hasClass("point_z_index_top")) {
                    this.actionPoint.view.$force_circle.removeClass("point_z_index_top");
                }
            }
        },
        _bindEvent: function () {
            var fThis = this;

            // 点击力部件,阻止向panel冒泡
            this.view.$ph_force.on("touchstart mousedown", function (evt) {
                var downEvent = Utils.getEvent(evt);
                Utils.preventDefault(downEvent);
                Utils.stopPropagation(downEvent);
                if (fThis.isAssistant) {
                    return;
                }
                if (preHandledObj) {
                    return;
                }
                var targetName = $(downEvent.target).attr('class').split(" ")[0];
                if (targetName == "force_line" || targetName == "ph_force" || targetName == "force_drag" || targetName == "icon_jt" || targetName == "force_arrow") {
                    fThis._toggleFSelectState();
                }
            });

            // 点击力名字span事件
            this.view.$force_name_span.on("mousedown touchstart", function () {
                if (fThis.isAssistant) {
                    return;
                }
                if (preHandledObj) {
                    preHandledObj._toggleForceTipsBox();
                }
                fThis._toggleForceTipsBox();
            });
            this.view.$tips_delete.on("mousedown touchstart", function () {// 删除事件
                fThis.logicallyDestroy(MESSAGE.NEED_POST);
            });
            this.view.$tips_ok.on("mousedown touchstart", function () {// 确定事件
                var val = fThis.view.$force_name_input.val();
                if (val == "") {
                    val = fThis.nameChar;
                }
                if (val != fThis.nameChar) {
                    if(val.length > 5) {
                      val = val.substring(0,5);
                    }
                    handler.sendMessage({
                        identify: MESSAGE.RENAME_OBJ,
                        target: fThis,
                        preState: {
                            name: fThis.nameChar
                        }
                    });
                }
                fThis.setName(val);
                fThis._toggleForceTipsBox();
            });

            // 拖拽事件
            this.view.$force_drag.on("touchstart mousedown", function (dragUpEvt) {
                var dragUpEvent = Utils.getEvent(dragUpEvt);
                Utils.stopPropagation(dragUpEvent);
                if (preHandledObj) {
                    return;
                }

                Utils.set2PenetrateState([$compoundPopupWindow,$decomposePopupWindow],true);

                var upPos = Utils.conversionCursorPos(dragUpEvent, $panel);

                var canJudgeAsDrag = false;// 拖拽 or 点击 标志位
                var alreadyPushUserInputToStack = false;// 控制只记录一次用户行为

                var msg = {
                    identify: MESSAGE.DRAG_FORCE,
                    target: fThis,
                    preState: {
                        x2: fThis.x2,
                        y2: fThis.y2
                    },
                    destroyedScene: fThis.actionPoint.scene
                };

                $panel.on("touchmove mousemove", function (evt2) {
                    //绘制力的预览视图
                    var e = Utils.getEvent(evt2);
                    var movePos = Utils.conversionCursorPos(e, $panel);

                    if (!canJudgeAsDrag && Utils.calDistance(upPos.x, upPos.y, movePos.x, movePos.y) > 10) {
                        canJudgeAsDrag = true;
                    }

                    if (canJudgeAsDrag) {// 用户拖拽了力
                        if (!alreadyPushUserInputToStack) {
                            alreadyPushUserInputToStack = true;
                            handler.sendMessage(msg);
                        }
                        // 执行拖拽力业务
                        if (Utils.applyBorderCtrl({'movePos':movePos,'fRef':fThis,'tag':TAG.DRAG_F_OR_FP})) {
                            return;
                        }
                        fThis.drag(movePos.x, movePos.y);
                    }
                });
                $panel.on("touchend mouseup", function (event) {
                    var evt = event || window.event;
                    var upPos = Utils.conversionCursorPos(evt, $panel);

                    Utils.set2PenetrateState([$compoundPopupWindow,$decomposePopupWindow],false);

                    if (fThis.view.$force_drag.hasClass("drag_show")) {
                        fThis.view.$force_drag.removeClass("drag_show");
                    }

                    // 更新坐标信息
                    fThis.x2 = upPos.x;
                    fThis.y2 = upPos.y;

                    // 判断力的长度是否过短，是，则重置为最小长度
                    if (Utils.calDistance(fThis.x1, fThis.y1, fThis.x2, fThis.y2) <= 40) {
                        fThis.drag(fThis.x1 + 40, fThis.y1);
                    }

                    // 销毁场景
                    if (fThis.actionPoint) {
                        if (fThis.actionPoint.scene) {
                            fThis.actionPoint.scene.logicallyDestroy();// 场景会先解绑作用点对象
                        }
                    }

                    $panel.off("mousemove touchmove");
                    $panel.off("mouseup touchend");

                    msg = null;
                    fThis._toggleFSelectState();
                });
            });
        },
        _init: function () {// 初始化，只会执行一次
            this._initView();
            this._bindEvent();
        },
        _draw: function () {// 力的绘制，只会执行一次
            this._init();
        },
        translate: function (moveX, moveY) {// 力的平移
            var deltaX = moveX - this.x1;// 更新起始坐标
            var deltaY = moveY - this.y1;
            this.x2 += deltaX;
            this.y2 += deltaY;
            this.x1 = moveX;
            this.y1 = moveY;
            this.view.$ph_force.css({// 设置偏移位置
                "left": this.x1,
                "top": this.y1 - this.view.$ph_force.height() / 2
            });
            this.view.$force_drag.css({
                "left": this.x2,
                "top": this.y2
            });
        },
        setName: function (val) {
            this.nameChar = val;
            this.view.$force_name_span.html(val);
            this.view.$force_name_input.val(val);
        },
        drag: function (x2, y2) {// 力的拖拽
            // 更新坐标
            this.x2 = x2;
            this.y2 = y2;
            var degree = Utils.calDegree(this.x1, this.y1, this.x2, this.y2);
            this.view.$ph_force.css({
                "width": Utils.calDistance(this.x1, this.y1, this.x2, this.y2),// 重新计算长度
                "transform": "rotate(" + degree + "deg)"// 重新计算旋转角度
            });
            this.view.$force_name_box.css("transform", "rotate(" + -degree + "deg)");
            this.view.$force_drag.css({
                "left": this.x2,
                "top": this.y2
            });
            if (this.x1 > this.x2) {
                this.view.$force_name_box.addClass("reverse_force_name_box");
                this.actionPoint.view.$circle_name_box.addClass("reverse_circle_name_box");
            } else {
                this.view.$force_name_box.removeClass("reverse_force_name_box");
                this.actionPoint.view.$circle_name_box.removeClass("reverse_circle_name_box");
            }
        },
        bindActionPoint: function (actionPoint) {// 力关联作用点
            this.actionPoint = actionPoint;
        },
        setVirtual: function (isVirtual) {// 设置是否为虚线力
            this.isDotted = isVirtual;
            if (isVirtual) {
                this.view.$ph_force.addClass("dotted_line");
            } else {
                this.view.$ph_force.removeClass("dotted_line");
            }
        },
        possessActionPoint: function (isPossess) {
            this.isPossessActionPoint = isPossess;
            if (isPossess) {
                this.actionPoint.setVirtual(false);// 作用点设置为真实的
                this.actionPoint.hideSelf(false);// 显示作用点
            } else {
                this.actionPoint.setVirtual(true);// 作用点设置为虚拟的
                this.actionPoint.hideSelf(true);// 隐藏作用点
            }
        },
        structurallyDestroy: function () {// 结构式销毁力对象
            // 结构式销毁力的视图
            this.view.$ph_force.remove();
            this.view.$force_drag.remove();

            // 处理作用点中的共点力记录
            if (this.actionPoint) {
                if (!this.actionPoint.isVirtual) {
                    var structurallyDestroyedObj;
                    for (var i = 0; i < this.actionPoint._concurrentForces.length; i++) {
                        if (this.actionPoint._concurrentForces[i].getId() == this.getId()) {
                            structurallyDestroyedObj = this.actionPoint._concurrentForces.splice(i, 1);
                            break;
                        }
                    }
                    structurallyDestroyedObj = null;
                } else {//虚拟作用点，则连带结构式销毁
                    this.actionPoint.view.$force_circle.remove();
                    this.actionPoint.view.$circle_name_box.remove();
                }
            }
        },
        resetView2Normal: function () {
            if (this.isAssistant) return;
            // 隐藏确认删除框
            if (this.isShowForceTipsBox) this._toggleForceTipsBox();
            // 力视图恢复为未选中状态
            if (this.isSelected) this._toggleFSelectState();
        },
        hideSelf: function (flag) {
            if (flag) {
                this.resetView2Normal();
                this.view.$ph_force.hide();
                if(this.getIdx() !== undefined) {// 非辅助力
                  fIdxContainer.remove(this.getIdx());
                }
            }
        },
        logicallyDestroy: function (isNeedPost) {// 逻辑式销毁力对象
            // 力视图恢复为未选中状态 并 隐藏力视图
            this.hideSelf(true);

            if (this.isAssistant) return;

            var scene;
            if (this.actionPoint) {
                // 场景被破坏，销毁场景
                if (this.actionPoint.scene) {
                    scene = this.actionPoint.scene;
                    this.actionPoint.scene.logicallyDestroy();
                }

                if (this.actionPoint.isVirtual) {
                    this.actionPoint.hideSelf(true);
                }
            }

            // 标志力被逻辑删除
            this._beenLogicallyDestroyed = true;

            if (isNeedPost) {
                // 发送消息
                var msg;
                if (this.actionPoint.isVirtual) {
                    msg = {
                        identify: MESSAGE.DROP_NON_CONCURRENT_FORCE,
                        target: this.actionPoint,
                        destroyedScene: scene
                    };
                } else {
                    msg = {
                        identify: MESSAGE.DROP_CONCURRENT_FORCE,
                        target: this,
                        destroyedScene: scene
                    };
                }
                handler.sendMessage(msg);
            }
        },
        restoreFromLogicallyDestroy: function () {
            if (this.actionPoint) {
                if (this.actionPoint.isVirtual) {
                    this.actionPoint.hideSelf(true);
                    // 同时把虚拟作用点加入到面板容器
                    panelContainer.add(this.actionPoint);
                }
            }
            this._beenLogicallyDestroyed = false;
            this.view.$ph_force.show();
            if (this.view.$force_drag.hasClass("drag_show")) {
                this.view.$force_drag.removeClass("drag_show");
            }
            if(this.getIdx() !== undefined) {
              fIdxContainer.add(this.getIdx());
            }
        }
    };

    // 2、作用点
    function FPoint(attrData) {
        this.id = Utils.getCurrentTimeMillis();// id不需要外部传入

        this.x = attrData.x || null;// 作用点的起始点坐标
        this.y = attrData.y || null;

        this.idx = undefined;
        this.nameChar = attrData.nameChar || "O";

        this.$panel = attrData.panel || $panel;// 记录该作用点所被添加的面板

        // 作用点记录与自己绑定的共点力——>方便做整体平移
        this._concurrentForces = [];
        this.scene = null;// 记录该共点力的一次 合成 || 分解 场景

        // 样式控制标志位
        this.isVirtual = attrData.isVirtual || false;// 控制是否是虚拟作用点
        this.isHideSelf = attrData.isHideSelf || false;// 控制是否隐藏或显示虚拟作用点

        // 逻辑控制标志位
        this.isShowForceTipsBox = false;// 控制是否显示作用点的确定删除框

        this._beenLogicallyDestroyed = false;

        // 视图
        this.view = {};

        this.draw();
    }

    FPoint.prototype = {
        getId: function () {
            return this.id;
        },
        getIdx: function() {
          return this.idx;
        },
        setIdx: function(idx) {
          this.idx = idx;
        },
        _initView: function () {
            // 创建作用点的各个部件
            this.view.$force_circle = $('<div class="force_circle" style="left:300px;top:200px;">');// circle_on || bg_solid || circle_vir || whole_drag
            this.view.$circle_name_box = $('<div class="circle_name_box" style="transform: rotate(0deg)"></div>');
            this.view.$circle_name_input = $('<input type="text" class="circle_name" />');// 切换为输入框状态,display:none || block
            this.view.$circle_name_span = $('<span class="circle_name"></span>');
            this.view.$force_tips_box = $('<div class="force_tips_box"></div>');// 现在不需要box_show
            this.view.$tips_delete = $('<a class="tips_delete" href="javascript:;">删除</a>');
            this.view.$tips_ok = $('<a class="tips_ok" href="javascript:;">确定</a>');

            this.view.$moving_state = $('<div class="moving_state"> ' +
                '' +
                '<span class="arrows_box"> ' +
                '<span class="icon_x_pos"></span>' +
                ' <span class="icon_x_rev"></span> ' +
                '<span class="icon_y_pos"></span> ' +
                '<span class="icon_y_rev"></span> ' +
                '</span> <span class="circle_big"></span>' +
                '<span class="circle_small"></span> ' +
                '</div>');

            // 组装控件
            this.view.$force_tips_box.append(this.view.$tips_delete);// 组装确认删除提示框
            this.view.$force_tips_box.append(this.view.$tips_ok);
            this.view.$circle_name_box.append(this.view.$circle_name_input);// 组装名字部件
            this.view.$circle_name_box.append(this.view.$circle_name_span);
            this.view.$circle_name_box.append(this.view.$force_tips_box);

            this.view.$force_circle.append(this.view.$moving_state);

            // 显示到面板上
            this.$panel.append(this.view.$force_circle);
            this.$panel.append(this.view.$circle_name_box);

            // 设置样式
            if (this.isVirtual) {
                this.view.$force_circle.addClass("circle_vir");
            }

            if (this.isHideSelf) {// 隐藏作用点自己
                this.view.$force_circle.hide();
                this.view.$circle_name_box.hide();
            }

            this.view.$circle_name_span.html(this.nameChar);
            this.view.$circle_name_input.val(this.nameChar);

            // 设置偏移位置
            this.view.$force_circle.css({
                "left": this.x,
                "top": this.y
            });
            this.view.$circle_name_box.css({
                "left": this.x,
                "top": this.y
            });
        },
        _toggleForceTipsBox: function () {
            var fPThis = this;
            fPThis.isShowForceTipsBox = !fPThis.isShowForceTipsBox;
            if (fPThis.isShowForceTipsBox) {
                this.view.$circle_name_input.val(this.nameChar);
                fPThis.view.$circle_name_box.addClass("name_edit z_index_top");
                this.view.$circle_name_input.focus();
                preHandledObj = fPThis;
            } else {
                if (fPThis.view.$circle_name_box.hasClass("name_edit")) {
                    fPThis.view.$circle_name_box.removeClass("name_edit z_index_top");
                }
                preHandledObj = null;
            }
        },
        _bindEvent: function () {
            var fpThis = this;

            /*************************************** Logic 绘制共点力 and 整体拖拽 ***************************************/

            var timeoutHandler;
            this.view.$force_circle.on("touchstart mousedown", function (circleDownEvt) {// 创建共点力逻辑
                var longPress = false;
                var concurrentForce;
                var hasCreateConcurrentForceView = false;

                var circleDownEvent = Utils.getEvent(circleDownEvt);
                Utils.preventDefault(circleDownEvt);
                Utils.stopPropagation(circleDownEvent);

                // 获取点击的坐标
                var downPos = Utils.conversionCursorPos(circleDownEvent, $panel);

                // 编辑态的切换业务
                if (preHandledObj) {
                    if (preHandledObj.getId() == fpThis.getId()) {
                        return;
                    }
                    else {
                        preHandledObj._toggleForceTipsBox();
                    }
                }

                // 长按作用点Logic ——> 拖动整体
                timeoutHandler = setTimeout(function () {
                    // 标志进入长按状态
                    longPress = true;

                    Utils.set2PenetrateState([$compoundPopupWindow,$decomposePopupWindow],true);

                    // 呈现整体拖动形态
                    fpThis.view.$force_circle.addClass("whole_drag");
                }, 300);

                var judgeAsMove = false;
                $panel.on("touchmove mousemove", function (panelMoveEvt) {
                    var panelMoveEvent = Utils.getEvent(panelMoveEvt);
                    // 获取移动的坐标
                    var movePos = Utils.conversionCursorPos(panelMoveEvent, $panel);

                    // 解决触摸笔问题加入的保护
                    if (Utils.calDistance(downPos.x, downPos.y, movePos.x, movePos.y) < 10) {
                        return;
                    }

                    if (timeoutHandler) {
                        clearTimeout(timeoutHandler);
                    }

                    if (longPress) {// 平移作用点
                        if (!judgeAsMove && Utils.calDistance(downPos.x, downPos.y, movePos.x, movePos.y) > 10) {
                            judgeAsMove = true;
                            handler.sendMessage({
                                identify: MESSAGE.TRANSLATE_POINT,
                                target: fpThis,
                                preState: {
                                    x: fpThis.x,
                                    y: fpThis.y
                                }
                            });
                        }
                        if (judgeAsMove && fpThis.view.$force_circle.hasClass("whole_drag")) {
                            if(Utils.applyBorderCtrl({'tag':TAG.DRAG_F_OR_FP,'movePos':movePos,'fPRef':fpThis})) {
                              return;
                            }
                            fpThis.translate(movePos.x, movePos.y);// 作用点偏移
                        }
                    } else {// 画共点力
                        if (currentPanelState == STATE.CAN_DRAW_F && !fpThis.isVirtual) {
                            if (!preHandledObj) {
                                if (!hasCreateConcurrentForceView && Utils.calDistance(fpThis.x, fpThis.y, movePos.x, movePos.y) > 26) {
                                    // 创建共点力
                                    var concurrentForceAttrData = {
                                        x1: fpThis.x,
                                        y1: fpThis.y,
                                        x2: movePos.x,
                                        y2: movePos.y,
                                        isDotted: true
                                    };
                                    var currentFIdx = fIdx + 1;
                                    if (currentFIdx == 0) {
                                        concurrentForceAttrData.nameChar = "F";
                                    } else {
                                        concurrentForceAttrData.nameChar = "F" + currentFIdx;
                                    }
                                    concurrentForce = new F(concurrentForceAttrData);
                                    concurrentForce.setIdx(currentFIdx);

                                    // 共点力与作用点相互关联
                                    concurrentForce.bindActionPoint(fpThis);
                                    fpThis.bindConcurrentForce(concurrentForce);

                                    hasCreateConcurrentForceView = true;
                                } else if (hasCreateConcurrentForceView) {// 拖拽共点力视图
                                    if (Utils.applyBorderCtrl({
                                      'tag': TAG.CREATE_CONCURRENT_F,
                                      'movePos':movePos,
                                      'hasCreateConcurrentForceView': hasCreateConcurrentForceView,
                                      'concurrentForce': concurrentForce,
                                      'fPRef': fpThis
                                    })) {
                                        return;
                                    }
                                    concurrentForce.drag(movePos.x, movePos.y);
                                }
                            }
                        }
                    }
                });
                $panel.on("touchend mouseup", function(panelUpEvt) {
                  var panelUpEvent = Utils.getEvent(panelUpEvt);
                  var upPos = Utils.conversionCursorPos(panelUpEvent, $panel);

                  // 长按处理逻辑释放
                  if (longPress) {
                    Utils.set2PenetrateState([$compoundPopupWindow,$decomposePopupWindow],false);
                    if (fpThis.view.$force_circle.hasClass("whole_drag")) {
                        fpThis.view.$force_circle.removeClass("whole_drag");
                    }
                    fpThis.view.$force_circle.on("mouseover touchstart", function () {
                        fpThis.view.$force_circle.addClass("circle_on");
                    });
                    fpThis.view.$force_circle.on("mouseout touchend", function () {
                        if (fpThis.view.$force_circle.hasClass("circle_on")) {
                            fpThis.view.$force_circle.removeClass("circle_on");
                        }
                        if (timeoutHandler) {
                            clearTimeout(timeoutHandler);
                        }
                    });
                  }

                  // 验证创建的共点力
                  CreationOperationVerification.verifyConcurrentForcesCreation({
                    'fPRef': fpThis,
                    'pos': upPos,
                    'concurrentForce': concurrentForce,
                    'hasCreateConcurrentForceView': hasCreateConcurrentForceView
                  });

                  // 解除面板临时绑定的事件
                  $panel.off("mousemove touchmove");
                  $panel.off("mouseup touchend");
                });
            });
            this.view.$force_circle.on("touchend mouseup", function () {
                clearTimeout(timeoutHandler);
            });
            this.view.$force_circle.on("mouseover touchstart", function () {
                fpThis.view.$force_circle.addClass("circle_on");
            });
            this.view.$force_circle.on("mouseout touchend", function () {
                if (timeoutHandler) {
                    clearTimeout(timeoutHandler);
                }
                if (fpThis.view.$force_circle.hasClass("circle_on")) {
                    fpThis.view.$force_circle.removeClass("circle_on");
                }
            });

            /*************************************** Logic 绘制共点力 and 整体拖拽 ***************************************/

            this.view.$circle_name_box.on("touchstart mousedown", function (evt) {// 阻止冒泡
                Utils.stopPropagation(Utils.getEvent(evt));
                Utils.preventDefault(Utils.getEvent(evt));
                $(evt.target).trigger("click");
            });
            this.view.$circle_name_span.on("click", function () {
                if (preHandledObj) {
                    preHandledObj._toggleForceTipsBox();
                }
                fpThis._toggleForceTipsBox();
            });
            this.view.$tips_delete.on("click", function () {
                fpThis.logicallyDestroy(MESSAGE.NEED_POST);
            });
            this.view.$tips_ok.on("click", function () {
                var val = fpThis.view.$circle_name_input.val();
                if (val == "") {
                    val = fpThis.nameChar;
                }
                if (val != fpThis.nameChar) {// 修改了作用点的名字
                    if(val.length > 5) {
                      val = val.substring(0,5);
                    }
                    handler.sendMessage({
                        identify: MESSAGE.RENAME_OBJ,
                        target: fpThis,
                        preState: {
                            name: fpThis.nameChar
                        }
                    });
                }
                fpThis.setName(val);
                fpThis._toggleForceTipsBox();
            });
        },
        _init: function () {
            this._initView();
            this._bindEvent();
        },
        draw: function () {// 作用点的绘制
            this._init();
        },
        setVirtual: function (isVirtual) {// 设置是否为虚拟作用点
            this.isVirtual = isVirtual;
            if (isVirtual) {
                this.view.$force_circle.addClass("circle_vir");
            } else {
                this.view.$force_circle.removeClass("circle_vir");
            }
        },
        bindScene: function (obj) {
            this.scene = obj;
        },
        bindConcurrentForce: function (concurrentForce) {// 作用点关联共点力
            if (concurrentForce instanceof F) {
                this._concurrentForces.push(concurrentForce);
            }
        },
        unbindConcurrentForce: function (obj) {
            if (obj instanceof F) {
                this._concurrentForces.deletePhysicsSynthesisObj(obj);
            }
        },
        setName: function (val) {
            this.nameChar = val;
            this.view.$circle_name_span.html(val);
            this.view.$circle_name_input.val(val);
        },
        hideSelf: function (isHide) {// 隐藏或显示作用点
            this.isHideSelf = isHide;
            if (isHide) {
                if (this.isShowForceTipsBox) {
                    this._toggleForceTipsBox();
                }
                this.view.$force_circle.hide();
                this.view.$circle_name_box.hide();
                if(!this.isVirtual && this.getIdx() !== undefined) {
                  pIdxContainer.remove(this.getIdx());
                }
            } else {
                this.view.$force_circle.show();
                this.view.$circle_name_box.show();
                if(!this.isVirtual && this.getIdx() !== undefined) {
                  pIdxContainer.add(this.getIdx());
                }
            }
        },
        translate: function (moveX, moveY) {// 作用点的平移
            this.view.$force_circle.css({
                "left": moveX,
                "top": moveY
            });
            this.view.$circle_name_box.css({
                "left": moveX,
                "top": moveY
            });

            // 更新作用点坐标
            this.x = moveX;
            this.y = moveY;

            // 平移绑定的场景信息
            if (this.scene) {
                this.scene.translate(moveX, moveY);
            }

            // 平移绑定的共点力
            this.translateConcurrentForces(moveX, moveY);
        },
        translateConcurrentForces: function (moveX, moveY) {
            var i = 0;
            var size;
            if (size = this._concurrentForces.length) {
                for (i = 0; i < size; ++i) {
                    this._concurrentForces[i].translate(moveX, moveY);
                }
            }
        },
        _removeThisFromConcurrentForces: function (obj) {
            this._concurrentForces.deletePhysicsSynthesisObj(obj);
        },
        structurallyDestroy: function () {// 结构式销毁作用点对象
            // 结构式销毁作用点视图
            this.view.$force_circle.remove();
            this.view.$circle_name_box.remove();

            // 结构式销毁绑定的共点力视图
            var structurallyDestroyedObj;
            while (this._concurrentForces.length > 0) {
                structurallyDestroyedObj = this._concurrentForces.shift();
                structurallyDestroyedObj.structurallyDestroy();
            }

            // 销毁场景
            if (this.scene) {
                this.scene.logicallyDestroy();
            }
        },
        logicallyDestroy: function (isNeedPost) {// 逻辑式删除作用点对象
            // 隐藏作用点自己
            this.hideSelf(true);

            // 只是隐藏所有共点力，不设置共点力的"_beenLogicallyDestroyed"标志位
            var size;
            if (size = this._concurrentForces.length) {
                var currentF;
                for (var i = size-1; i >= 0; --i) {
                    currentF = this._concurrentForces[i];
                    currentF.hideSelf(true);
                }
            }

            // 销毁绑定的场景
            if (this.scene) {
                this.scene.logicallyDestroy();
            }

            // 标志作用点被逻辑删除
            this._beenLogicallyDestroyed = true;

            if (isNeedPost) {
                // 发送消息
                handler.sendMessage({
                    identify: MESSAGE.DROP_POINT,
                    target: this
                });
            }

        },
        restoreFromLogicallyDestroy: function () {
            // 恢复显示作用点
            this.hideSelf(false);

            // 恢复逻辑式销毁绑定的共点力
            var size;
            if (size = this._concurrentForces.length) {
                for (var i = 0; i < size; i++) {
                    if (!this._concurrentForces[i]._beenLogicallyDestroyed) {// 不是被手动删除，删除作用点的时候一并隐藏共点力情况
                        this._concurrentForces[i].restoreFromLogicallyDestroy();
                    }
                }
            }
        }
    };

    // 3、场景
    function Scene(attrData) {
        this.associatedPoint = attrData.associatedPoint || null;
        this.type = attrData.type || SCENE_TYPE.FD;// 场景类型：SCENE_TYPE.FD：分解场景 SCENE_TYPE.FC：合成场景
        this.joinForces = [];// 记录合力
        this.componentForces = [];// 记录分力
        this.auxiliaryLines = [];// 记录辅助线
        this.coordinates = null;// 记录坐标轴
    }

    Scene.prototype = {
        _bindActionPoint: function () {
            this.associatedPoint.scene = this;
        },
        _unbindActionPoint: function () {
            this.associatedPoint.scene = null;
        },
        recordJoinForce: function (obj) {// 记录合力
            this.joinForces.push(obj);
        },
        recordComponentForce: function (obj) {// 记录分力
            this.componentForces.push(obj);
        },
        recordAuxiliaryLine: function (obj) {// 记录辅助线
            this.auxiliaryLines.push(obj);
        },
        recordCoordinates: function (obj) {// 记录坐标轴
            this.coordinates = obj;
        },
        translate: function (moveX, moveY) {// 场景的平移
            var deltaX = 0;
            var deltaY = 0;

            // 平移坐标轴
            if (this.coordinates) {
                this.coordinates.translate(moveX, moveY);
            }

            // 平移分力
            var size;
            if (this.componentForces && (size = this.componentForces.length)) {
                deltaX = moveX - this.componentForces[0].x1;
                deltaY = moveY - this.componentForces[0].y1;
                for (var i = 0; i < size; ++i) {
                    this.componentForces[i].translate(moveX, moveY);
                }
            }

            // 平移合力
            if (this.joinForces && (size = this.joinForces.length)) {
                deltaX = moveX - this.joinForces[0].x1;
                deltaY = moveY - this.joinForces[0].y1;
                for (i = 0; i < size; ++i) {
                    this.joinForces[i].translate(moveX, moveY);
                }
            }

            // 平移辅助线
            if (this.auxiliaryLines && (size = this.auxiliaryLines.length)) {
                for (i = 0; i < size; ++i) {
                    this.auxiliaryLines[i].translate(deltaX, deltaY);
                }
            }
        },
        logicallyDestroy: function () {
            this._unbindActionPoint();
            if (this.coordinates) {
                this.coordinates.logicallyDestroy();
            }
            var size;
            if (this.auxiliaryLines && (size = this.auxiliaryLines.length)) {
                for (var i = 0; i < size; ++i) {
                    this.auxiliaryLines[i].logicallyDestroy();
                }
            }
            if (this.type == SCENE_TYPE.FD) {
                if (this.componentForces && (size = this.componentForces.length)) {
                    for (i = 0; i < size; ++i) {
                        this.componentForces[i].logicallyDestroy();
                    }
                }
            }
            if (this.type == SCENE_TYPE.FC) {
                if (this.joinForces && (size = this.joinForces.length)) {
                    for (i = 0; i < size; ++i) {
                        this.joinForces[i].logicallyDestroy(MESSAGE.NO_NEED_POST);
                    }
                }
            }
        },
        restoreFromLogicallyDestroy: function () {
            this._bindActionPoint();
            if (this.coordinates) {
                this.coordinates.restoreFromLogicallyDestroy();
            }
            var size;
            if (this.auxiliaryLines && (size = this.auxiliaryLines.length)) {
                for (var i = 0; i < size; ++i) {
                    this.auxiliaryLines[i].restoreFromLogicallyDestroy();
                }
            }
            if (this.type == SCENE_TYPE.FD) {
                if (this.componentForces && (size = this.componentForces.length)) {
                    for (i = 0; i < size; ++i) {
                        this.componentForces[i].restoreFromLogicallyDestroy();
                    }
                }
            }
            if (this.type == SCENE_TYPE.FC) {
                if (this.joinForces && (size = this.joinForces.length)) {
                    for (i = 0; i < size; i++) {
                        this.joinForces[i].restoreFromLogicallyDestroy();
                    }
                }
            }
        }
    };

    // 4、坐标轴
    function Coordinates(attrData) {
        this.x = attrData.x || 300;
        this.y = attrData.y || 300;
        this.xPositiveLen = attrData.xPositiveLen || 300;
        this.xNegativeLen = attrData.xNegativeLen || 300;
        this.yPositiveLen = attrData.yPositiveLen || 300;
        this.yNegativeLen = attrData.yNegativeLen || 300;

        this.$co_origin = null;
        this.$x_positive_span = null;
        this.$x_reverse_span = null;
        this.$y_positive_span = null;
        this.$y_reverse_span = null;

        this.draw();
    }

    Coordinates.prototype = {
        initView: function () {
            this.$co_origin = $('<div class="co_origin"></div>');
            this.$x_positive_span = $('<span class="x_positive iconfont"><span class="icon_jt">&#xe613;</span></span>');
            this.$x_reverse_span = $('<span class="x_reverse"></span>');
            this.$y_positive_span = $('<span class="y_positive iconfont"><span class="icon_jt">&#xe613;</span></span>');
            this.$y_reverse_span = $('<span class="y_reverse"></span>');

            this.$co_origin.append(this.$x_positive_span);
            this.$co_origin.append(this.$x_reverse_span);
            this.$co_origin.append(this.$y_positive_span);
            this.$co_origin.append(this.$y_reverse_span);

            $panel.append(this.$co_origin);

            // 设置偏移位置
            this.$co_origin.css({
                "left": this.x,
                "top": this.y
            });

            // 设置四个方向的长度
            this.$x_positive_span.css("width", this.xPositiveLen);
            this.$x_reverse_span.css("width", this.xNegativeLen);
            this.$y_positive_span.css("width", this.yPositiveLen);
            this.$y_reverse_span.css("width", this.yNegativeLen);
        },
        translate: function (moveX, moveY) {
            this.$co_origin.css({
                "left": moveX,
                "top": moveY
            });
        },
        setXPositiveLen: function (len) {
            this.$x_positive_span.css("width", len);
        },
        setXReverseLen: function (len) {
            this.$x_reverse_span.css("width", len);
        },
        setYPositiveLen: function (len) {
            this.$y_positive_span.css("width", len);
        },
        setYReverseLen: function (len) {
            this.$y_reverse_span.css("width", len);
        },
        draw: function () {
            this.initView();
        },
        logicallyDestroy: function () {
            this.$co_origin.hide();
        },
        restoreFromLogicallyDestroy: function () {
            this.$co_origin.show();
        },
        structurallyDestroy: function () {
            this.$co_origin.remove();
        }
    };

    // 4、虚线
    function DashLine(attrData) {
        this.x1 = attrData.x1 || 300;
        this.y1 = attrData.y1 || 300;
        this.x2 = attrData.x2 || 400;
        this.y2 = attrData.y2 || 400;

        this.isTranslucent = attrData.isTranslucent || false;

        this.$line_dashed = null;
        this.aux_line = null;

        this.color = attrData.color || null;

        this.draw();
    }

    DashLine.prototype = {
        _initView: function () {
            // bg_translucent 半透明
            this.$line_dashed = $('<div class="line_dashed" style="top:60px; left:276px; width:200px;transform: rotate(20deg);"></div>');
            this.aux_line = $('<div class="Aux_line"></div>');

            this.$line_dashed.append(this.aux_line);

            $panel.append(this.$line_dashed);

            // 设置半透明
            if (this.isTranslucent) {
                this.$line_dashed.addClass("bg_translucent");
            }

            // 设置颜色
            if (this.color) {
                this.$line_dashed.addClass(this.color);
            }

            this.$line_dashed.css({
                "left": this.x1,// 设置偏移位置
                "top": this.y1,
                "width": Utils.calDistance(this.x1, this.y1, this.x2, this.y2),// 计算长度
                "transform": "rotate(" + Utils.calDegree(this.x1, this.y1, this.x2, this.y2) + "deg)"// 计算旋转角度
            });
        },
        translate: function (deltaX, deltaY) {
            this.x1 += deltaX;
            this.y1 += deltaY;
            this.$line_dashed.css({
                "left": this.x1,// 设置偏移位置
                "top": this.y1
            });
        },
        draw: function () {
            this._initView();
        },
        logicallyDestroy: function () {
            this.$line_dashed.hide();
        },
        restoreFromLogicallyDestroy: function () {
            this.$line_dashed.show();
        },
        structurallyDestroy: function () {
            this.$line_dashed.remove();
        }
    };

    /********************************************************************************************************/

    var Presenter = BasicPresenter.extend({
        /**
         * Presenter的初始化方法
         * @private
         */
        $init: function () {
            this._super();
        },
        /**
         * Presenter对外暴露的方法
         */
        _service_: {
            constructor: function (parent) {
                this.parent = parent;
            },
            getQuestionInfo: function () {
                return {
                    'notExistStatistics': true,
                    'noNeedQuizProgress': true
                };
            },
            getExtendData: function () {
                return {
                    width: '100%'
                };
            }
        },
        getService: function () {
            this._service_.constructor(this);
            return this._service_;
        },
        /****以下开始为icPlayer的生命周期方法*****/
        run: function (view, model) {
            // 初始化控件视图
            findView();

            // 初始化容器
            init();
        },
        pageShow: function () {
            this._bindEvent();
        },
        pageLeave: function () {
            this._unbindEvent();
        },
        destroy: function () {

        },
        /**如果不需要处理icplayer的状态恢复事件, 请将以下两个方法删除掉**/
        getState: function () {

        },
        setState: function (state, options) {

        },
        /****以下开始为Presenter的私有方法*****/
        _bindEvent: function () {
            //画作用点
            $btnDrawFP.on("click", function () {
                switchState(STATE.CAN_DRAW_FP);
            });
            //画作用力
            $btnDrawF.on("click", function () {
                switchState(STATE.CAN_DRAW_F);
            });

            /********************************** $panel logic 力的合成 **********************************/

            $btnFCompound.on('click', function () {
                if ($(this).hasClass('disabled')) return;
                switchState(STATE.CAN_DO_FC);
                Consult.updateFCFDPopupWindow();
            });
            $compoundPWConfirm.on("click", function () {
                if ($(this).hasClass("disabled")) {
                    return;
                }
                var concurrentForces;
                var scenes = [];
                var scene;
                while (cdQ._array.length > 0) {
                    concurrentForces = cdQ.deQueue();
                    scene = PhysicsSynthesis.doFCompound(concurrentForces);
                    if (scene) {
                        scenes.push(scene);
                    }
                }
                if (scenes && scenes.length > 0) {
                    handler.sendMessage({
                        identify: MESSAGE.COMPOUND_FORCES,
                        scenes: scenes
                    });
                }
                switchState(STATE.CAN_DO_FC);
            });
            $compoundPWCancel.on("click", function () {
                switchState(STATE.CAN_DO_FC);
            });

            /********************************** $panel logic 力的分解 **********************************/

            $btnFDecompose.on("click", function () {
                if ($(this).hasClass('disabled')) return;
                switchState(STATE.CAN_DO_FD);
                Consult.updateFCFDPopupWindow();
            });
            $decomposePWConfirm.on("click", function () {
                if ($decomposePWConfirm.hasClass("disabled")) {
                    return;
                }
                var concurrentForces;
                var scenes = [];
                var scene;
                while (cdQ._array.length > 0) {
                    concurrentForces = cdQ.deQueue();
                    scene = PhysicsSynthesis.doFDecompose(concurrentForces);
                    if (scene) {
                        scenes.push(scene);
                    }
                }
                if (scenes && scenes.length > 0) {
                    handler.sendMessage({
                        identify: MESSAGE.DECOMPOSE_FORCES,
                        scenes: scenes
                    });
                }
                switchState(STATE.CAN_DO_FD);
            });
            $decomposePWCancel.on("click", function () {
                switchState(STATE.CAN_DO_FD);
            });

            /********************************** $panel logic 创建力 and 创建作用点 **********************************/

            $panel.on("mousedown touchstart", function (downEvt) {
                var downEvent = Utils.getEvent(downEvt);
                Utils.preventDefault(downEvent);
                Utils.stopPropagation(downEvent);
                var downPos = Utils.conversionCursorPos(downEvent, $panel);

                if (preHandledObj) {
                    preHandledObj._toggleForceTipsBox();
                    return;
                }

                if (currentPanelState == STATE.CAN_DRAW_FP || currentPanelState == STATE.CAN_DRAW_F) {
                    // 创建临时作用点
                    var actionPointAttrData = {
                        x: downPos.x,
                        y: downPos.y,
                        isVirtual: true,
                        panel: $panel
                    };
                    var currentPIdx = pIdx + 1;
                    if (currentPIdx == 0) {
                        actionPointAttrData.nameChar = "O";
                    } else {
                        actionPointAttrData.nameChar = "O" + currentPIdx;
                    }
                    var actionPoint = new FPoint(actionPointAttrData);
                    actionPoint.setIdx(currentPIdx);

                    var tmpF;// 待创建的临时力句柄
                    var alreadyNewF = false;// 标志是否已经创建了力视图
                    $panel.on("touchmove mousemove", function (moveEvt) {
                      var moveEvent = Utils.getEvent(moveEvt);
                      var movePos = Utils.conversionCursorPos(moveEvent, $panel);

                      if (currentPanelState == STATE.CAN_DRAW_F) {
                          if (!alreadyNewF && Utils.calDistance(downPos.x, downPos.y, movePos.x, movePos.y) > 26) {
                            // 创建临时作用力
                            var fAttrData = {
                              x1: downPos.x,
                              y1: downPos.y,
                              x2: movePos.x,
                              y2: movePos.y,
                              isDotted: true,
                              panel: $panel
                            };
                            var currentFIdx = fIdx + 1;
                            if (currentFIdx == 0) {
                              fAttrData.nameChar = "F";
                            } else {
                              fAttrData.nameChar = "F" + currentFIdx;
                            }
                            tmpF = new F(fAttrData);
                            alreadyNewF = true;// 标识已经创建过力了
                            tmpF.setIdx(currentFIdx);

                            // 立即执行关联操作
                            tmpF.bindActionPoint(actionPoint);
                            actionPoint.bindConcurrentForce(tmpF);
                        }
                        if (tmpF) {// 已经创建力了 ——> 拖拽力
                          if(Utils.applyBorderCtrl({
                            'movePos':movePos,
                            'downPos':downPos,
                            'fRef':tmpF,
                            'alreadyNewF':alreadyNewF,
                            'fPRef':actionPoint,
                            'tag':TAG.CREATE_F_OR_FP
                          })) {
                            return;
                          }
                          tmpF.drag(movePos.x, movePos.y);
                        }
                      }
                    });
                    $panel.on("touchend mouseup",function(upEvt) {
                      var upEvent = Utils.getEvent(upEvt);
                      var upPos = Utils.conversionCursorPos(upEvent, $panel);

                      // 验证作用点和力
                      CreationOperationVerification.verifyFOrFPCreation({
                        'actionPoint':actionPoint,
                        'tmpF':tmpF,
                        'upPos':upPos,
                        'downPos':downPos,
                        'alreadyNewF':alreadyNewF
                      });

                      // 解除所有命名空间下的事件绑定
                      $panel.off("mousemove touchmove");
                      $panel.off("mouseup touchend");
                    });
                }
            });

            /********************************** 清空按钮 **********************************/

            $btnCleanUp.on("click", function () {
                if ($(this).hasClass("disabled")) return;
                $cleanUpPopupWindow.show();
                if ($maskLayer.hasClass("show")) return;
                $maskLayer.addClass('show');
            });
            $cleanUpPWConfirm.on("click", function () {
                PhysicsSynthesis.cleanUpPanel();
            });
            $cleanUpPWCancel.on("click", function () {
                $cleanUpPopupWindow.hide();
                if ($maskLayer.hasClass("show")) $maskLayer.removeClass("show");
            });

            /********************************** 滑动按钮 **********************************/

            $sliderRegion.on("click", function () {
                if ($sliderRegion.hasClass('disabled')) {
                    return;
                }
                $sliderRegion.toggleClass('checked');
                possessActionPoint = $sliderRegion.hasClass('checked') ? true : false;
            });

            /********************************** 撤销 与 恢复 按钮 **********************************/

            $btnUndo.on("click", function () {
                switchState(currentPanelState);
                if ($(this).hasClass("disabled")) return;
                var userAction = undoStack.popStack();
                if (userAction) {
                    redoStack.pushStack(userAction);
                    switch (userAction.doWhat) {
                        case MESSAGE.ADD_POINT:
                            userAction.actionObj.logicallyDestroy(MESSAGE.NO_NEED_POST);
                            panelContainer.remove(userAction.actionObj);
                            break;
                        case MESSAGE.ADD_FORCE_WITH_POINT:
                            if (userAction.actionObj.isSelected) {
                                userAction.actionObj._toggleFSelectState();
                            }
                            userAction.actionObj.actionPoint.logicallyDestroy(MESSAGE.NO_NEED_POST);
                            panelContainer.remove(userAction.actionObj.actionPoint);
                            break;
                        case MESSAGE.ADD_CONCURRENT_FORCE:
                            if (userAction.actionObj.isSelected) {
                                userAction.actionObj._toggleFSelectState();
                            }
                            userAction.actionObj.logicallyDestroy(MESSAGE.NO_NEED_POST);
                            break;
                        case MESSAGE.DROP_CONCURRENT_FORCE:
                            userAction.actionObj.restoreFromLogicallyDestroy();
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.restoreFromLogicallyDestroy();
                            }
                            break;
                        case MESSAGE.DROP_NON_CONCURRENT_FORCE:
                            if (userAction.actionObj.isSelected) {
                                userAction.actionObj._toggleFSelectState();
                            }
                            userAction.actionObj._concurrentForces[0].restoreFromLogicallyDestroy();
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.restoreFromLogicallyDestroy();
                            }
                            break;
                        case MESSAGE.DROP_POINT:
                            userAction.actionObj.restoreFromLogicallyDestroy();
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.restoreFromLogicallyDestroy();
                            }
                            panelContainer.add(userAction.actionObj);
                            break;
                        case MESSAGE.RENAME_OBJ:
                            var preName = userAction.actionObj.nameChar;
                            userAction.actionObj.setName(userAction.preState.name);
                            userAction.preState.name = preName;
                            break;
                        case MESSAGE.DRAG_FORCE:
                            var preX2 = userAction.actionObj.x2;
                            var preY2 = userAction.actionObj.y2;
                            userAction.actionObj.drag(userAction.preState.x2, userAction.preState.y2);
                            userAction.preState.x2 = preX2;
                            userAction.preState.y2 = preY2;
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.restoreFromLogicallyDestroy();
                            }
                            break;
                        case MESSAGE.TRANSLATE_POINT:
                            var preX = userAction.actionObj.x;
                            var preY = userAction.actionObj.y;
                            userAction.actionObj.translate(userAction.preState.x, userAction.preState.y);// 平移作用点
                            userAction.preState.x = preX;
                            userAction.preState.y = preY;
                            break;
                        case MESSAGE.COMPOUND_FORCES:
                            var compoundScene;
                            if (userAction.scenes) {
                                for (var i = 0; i < userAction.scenes.length; ++i) {
                                    compoundScene = userAction.scenes[i];
                                    compoundScene.scene.logicallyDestroy();
                                    if (compoundScene.destroyedScene) {
                                        compoundScene.destroyedScene.restoreFromLogicallyDestroy();
                                    }
                                }
                            }
                            break;
                        case MESSAGE.DECOMPOSE_FORCES:
                            var decomposeScene;
                            if (userAction.scenes) {
                                for (var i = 0; i < userAction.scenes.length; ++i) {
                                    decomposeScene = userAction.scenes[i];
                                    decomposeScene.scene.logicallyDestroy();
                                    if (decomposeScene.destroyedScene) {
                                        decomposeScene.destroyedScene.restoreFromLogicallyDestroy();
                                    }
                                }
                            }
                            break;
                    }
                    Consult.askMeetFCFDCondition();
                    Consult.askMeetCleanUPCondition();
                }
            });

            $btnRedo.on("click", function () {
                switchState(currentPanelState);
                if ($(this).hasClass("disabled")) return;
                var userAction = redoStack.popStack();
                if (userAction) {
                    undoStack.pushStack(userAction);
                    switch (userAction.doWhat) {
                        case MESSAGE.ADD_POINT:
                            userAction.actionObj.restoreFromLogicallyDestroy();
                            panelContainer.add(userAction.actionObj);
                            break;
                        case MESSAGE.ADD_FORCE_WITH_POINT:
                            userAction.actionObj.actionPoint.restoreFromLogicallyDestroy();
                            if (!userAction.actionObj.actionPoint.isVirtual) {
                                panelContainer.add(userAction.actionObj.actionPoint);
                            }
                            break;
                        case MESSAGE.ADD_CONCURRENT_FORCE:
                            userAction.actionObj.restoreFromLogicallyDestroy();
                            break;
                        case MESSAGE.DROP_CONCURRENT_FORCE:
                            userAction.actionObj.logicallyDestroy(MESSAGE.NO_NEED_POST);
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.logicallyDestroy();
                            }
                            break;
                        case MESSAGE.DROP_NON_CONCURRENT_FORCE:
                            userAction.actionObj._concurrentForces[0].logicallyDestroy();
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.logicallyDestroy();
                            }
                            panelContainer.remove(userAction.actionObj);
                            break;
                        case MESSAGE.DROP_POINT:
                            userAction.actionObj.logicallyDestroy();
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.logicallyDestroy();
                            }
                            panelContainer.remove(userAction.actionObj);
                            break;
                        case MESSAGE.RENAME_OBJ:
                            var preName = userAction.actionObj.nameChar;
                            userAction.actionObj.setName(userAction.preState.name);// 作用点偏移
                            userAction.preState.name = preName;
                            break;
                        case MESSAGE.DRAG_FORCE:
                            if (userAction.destroyedScene) {
                                userAction.destroyedScene.logicallyDestroy();
                            }
                            var preX2 = userAction.actionObj.x2;
                            var preY2 = userAction.actionObj.y2;
                            userAction.actionObj.drag(userAction.preState.x2, userAction.preState.y2);
                            userAction.preState.x2 = preX2;
                            userAction.preState.y2 = preY2;
                            break;
                        case MESSAGE.TRANSLATE_POINT:
                            var preX = userAction.actionObj.x;
                            var preY = userAction.actionObj.y;
                            userAction.actionObj.translate(userAction.preState.x, userAction.preState.y);// 作用点偏移
                            userAction.preState.x = preX;
                            userAction.preState.y = preY;
                            break;
                        case MESSAGE.COMPOUND_FORCES:
                            var compoundScene;
                            if (userAction.scenes) {
                                for (var i = 0; i < userAction.scenes.length; i++) {
                                    compoundScene = userAction.scenes[i];
                                    if (compoundScene.destroyedScene) {
                                        compoundScene.destroyedScene.logicallyDestroy();
                                    }
                                    compoundScene.scene.restoreFromLogicallyDestroy();
                                }
                            }
                            break;
                        case MESSAGE.DECOMPOSE_FORCES:
                            var decomposeScene;
                            if (userAction.scenes) {
                                for (var i = 0; i < userAction.scenes.length; ++i) {
                                    decomposeScene = userAction.scenes[i];
                                    if (decomposeScene.destroyedScene) {
                                        decomposeScene.destroyedScene.logicallyDestroy();
                                    }
                                    decomposeScene.scene.restoreFromLogicallyDestroy();
                                }
                            }
                            break;
                    }
                    Consult.askMeetFCFDCondition();
                    Consult.askMeetCleanUPCondition();
                }
            });
        },
        _unbindEvent: function () {
            switchState(currentPanelState);
            PhysicsSynthesis.cleanUpPanel();
            Consult.updateFCFDPopupWindow();

            Array.prototype.deletePhysicsSynthesisObj = null;
            panelContainer = null;
            redoStack = null;
            undoStack = null;
            cdQ = null;

            $btnDrawFP.off("click");
            $btnDrawF.off("click");
            $btnFCompound.off("click");
            $compoundPWConfirm.off("click");
            $compoundPWCancel.off("click");
            $btnFDecompose.off("click");
            $decomposePWConfirm.off("click");
            $decomposePWCancel.off("click");
            $panel.off("mousedown touchstart");
            $btnCleanUp.off("click");
            $cleanUpPWConfirm.off("click");
            $cleanUpPWCancel.off("click");
            $btnSlider.off("click");
            $btnUndo.off("click");
            $btnRedo.off("click");
        }
    });

    Presenter.getQuestionInfo = function () {
        return {
            'notExistStatistics': true,
            'noNeedQuizProgress': true
        };
    };

    Presenter.getExtendData = function () {
        return {
            width: '100%'
        };
    };

    window.AddonPhysicsPower_create = function () {
        return new Presenter('PhysicsPower');
    }
})();
