let ms, maxDays = 7, initialFormState = {};

function waitForMemberstack() {
    return new Promise((resolve) => {
        if (window.$memberstackDom) {
            resolve(window.$memberstackDom);
        } else {
            const interval = setInterval(() => {
                if (window.$memberstackDom) {
                    clearInterval(interval);
                    resolve(window.$memberstackDom);
                }
            }, 100);
            setTimeout(() => {
                clearInterval(interval);
                resolve(null);
            }, 5000);
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        ms = await waitForMemberstack();
        if (!ms) {
            console.error("Memberstack not loaded");
            return;
        }
        ms.getCurrentMember().then(({ data: m }) => {
            if (m) {
                console.log("Member-data found:", m);
                const bendingPlan = m.planConnections?.[0]?.planId || "unknown",
                      planName = {
                          "pln_protector-xq9009aw": "Protector",
                          "pln_guardian-ny91091v": "Guardian",
                          "pln_guardian-angel-bo1ba0e39": "Guardian Angel"
                      }[bendingPlan.toLowerCase()] || "Unknown",
                      maxDaysPerPlan = {
                          "pln_protector-xq9009aw": 3,
                          "pln_guardian-ny91091v": 5,
                          "pln_guardian-angel-bo1ba0e39": 7
                      };
                maxDays = maxDaysPerPlan[bendingPlan.toLowerCase()] || 7;
                document.getElementById("usr-plan-dsp").textContent = planName;
                prefillPh("svc-num", m.customFields["number-for-service-delivery"]);
                const s = m.customFields["service-status"];
                if (s) document.querySelector(`input[name="svc-sts"][value="${s}"]`).checked = true;
                else document.getElementById("svc-sts-act").checked = true;
                const c = m.customFields["user-channel"];
                if (c) document.querySelector(`input[name="svc-cnt"][value="${c}"]`).checked = true;
                const t = m.customFields["time-zone"];
                if (t) document.getElementById("svc-tz").value = t;
                const td = m.customFields["time-delay"];
                if (td) document.querySelector(`input[name="tm-dly"][value="${td}"]`).checked = true;
                window.memberstackTimes = {};
                const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
                days.forEach(d => {
                    window.memberstackTimes[d] = {};
                    for (let i = 1; i <= 6; i++) {
                        const t = m.customFields[`${d}-time-${i}`];
                        if (t) window.memberstackTimes[d][`time-${i}`] = t;
                    }
                });
                const dayFields = ["day-one", "day-two", "day-three", "day-four", "day-five", "day-six", "day-seven"];
                const dayIds = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
                dayFields.forEach((field, index) => {
                    const selected = m.customFields[field];
                    if (selected) document.getElementById(`day-${dayIds[index]}`).checked = true;
                });
                const emg = ["one", "two", "three", "four", "five", "six"];
                emg.forEach((n, i) => {
                    const fn = m.customFields[`contact-${n}-first-name`],
                          ln = m.customFields[`contact-${n}-last-name`],
                          ph = m.customFields[`contact-${n}-mobile-number`];
                    if (fn || ln || ph) {
                        const cnt = document.getElementById(`cnt-${i + 1}`);
                        if (cnt) {
                            cnt.querySelector(`#cnt-${i + 1}-fname`).value = fn || "";
                            cnt.querySelector(`#cnt-${i + 1}-lname`).value = ln || "";
                            prefillPh(`cnt-${i + 1}-ph`, ph);
                        }
                    }
                });
                initTabs();
                initSch();
                initEmg();
                initVal();
                updateRadioStyles();
                initRadioButtons();
                initialFormState = captureFormState();
                updateAllSaveButtons();
            }
        }).catch(err => {
            console.error("Error fetching member data:", err);
        });
    } catch (err) {
        console.error("Initialization error:", err);
    }
});

function initRadioButtons() {
    const svcStsRadios = document.querySelectorAll('input[name="svc-sts"]');
    svcStsRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            updateRadioStyles();
            debouncedUpdateSaveButton(radio.closest(".nst-sec-cnt"));
        });
    });

    const svcCntRadios = document.querySelectorAll('input[name="svc-cnt"]');
    svcCntRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            updateRadioStyles();
            debouncedUpdateSaveButton(radio.closest(".nst-sec-cnt"));
        });
    });

    const tmDlyRadios = document.querySelectorAll('input[name="tm-dly"]');
    tmDlyRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            updateRadioStyles();
            debouncedUpdateSaveButton(radio.closest(".nst-sec-cnt"));
        });
    });

    document.querySelectorAll('.day-chk').forEach(chk => {
        chk.addEventListener('change', () => {
            updateRadioStyles();
            updateDynamicDays();
        });
    });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const debouncedUpdateSaveButton = debounce(updateSaveButton, 100);

function initTabs() {
    const tabs = document.querySelectorAll(".tab-btn"),
          panels = document.querySelectorAll(".tab-panel");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            const panelId = tab.getAttribute("data-tab");
            const panel = document.getElementById(panelId);
            panel.classList.add("active");
            setTimeout(() => panel.style.opacity = "1", 10);
            updateAllSaveButtons();
        });
    });
}

function prefillPh(i, v) {
    if (!v) return;
    const n = document.getElementById(i);
    if (n) {
        const iti = window.intlTelInputGlobals.getInstance(n);
        if (iti) {
            iti.setNumber(v);
        } else {
            n.value = v;
        }
    }
}

function initSch() {
    try {
        const d = document.getElementById("sch-days"),
              c = document.querySelectorAll(".day-chk"),
              w = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        let dayStates = {};

        document.getElementById("max-days-dsp").textContent = maxDays;

        function addDay(dy, idx) {
            if (d.querySelector(`.day-sec[data-day="${dy}"]`)) return;
            const id = `day-${idx + 1}`,
                  dv = document.createElement("div");
            dv.classList.add("day-sec");
            dv.dataset.day = dy;
            dv.setAttribute("id", `sch-day-${id}`);
            dv.innerHTML = `<button type="button" class="rmv-cnt">✕</button><div class="cnt-hdr">${dy}</div><div class="time-row" id="${id}-tm-slts"></div><div class="time-btn-row"><button type="button" class="sv-btn" data-day="${id}">Add Time</button><button type="button" class="sv-btn clear-times-btn" data-day="${id}">Clear Times</button><button type="button" class="sv-btn" data-section="sch-day-${id}">Save</button></div>`;
            d.appendChild(dv);
            const ts = dv.querySelector(`#${id}-tm-slts`);
            if (!dayStates[dy.toLowerCase()]) {
                dayStates[dy.toLowerCase()] = { count: 3, times: {} };
                const dayLower = dy.toLowerCase();
                if (window.memberstackTimes && window.memberstackTimes[dayLower]) {
                    Object.keys(window.memberstackTimes[dayLower]).forEach(key => {
                        dayStates[dayLower].times[key] = window.memberstackTimes[dayLower][key];
                    });
                }
            }
            const state = dayStates[dy.toLowerCase()];
            for (let j = 0; j < state.count; j++) {
                const tid = `${id}-tm-${j + 1}`,
                      tdiv = document.createElement("div");
                tdiv.classList.add("cnt-wrp");
                tdiv.innerHTML = `<label class="fld-lbl" for="${tid}">Time ${j + 1}${j === 0 ? " *" : ""}</label><input type="time" class="txt-inp" id="${tid}" data-ms-member="${dy.toLowerCase()}-time-${j + 1}" placeholder="08:30"${j === 0 ? ' required' : ''}>`;
                ts.appendChild(tdiv);
                const tInput = ts.querySelector(`#${tid}`);
                if (state.times[`time-${j + 1}`]) tInput.value = state.times[`time-${j + 1}`];
            }
            dv.querySelector(".sv-btn[data-day]").addEventListener("click", () => {
                if (state.count >= 6) {
                    alert("Maximum of 6 times reached");
                    return;
                }
                state.count++;
                const tid = `${id}-tm-${state.count}`,
                      tdiv = document.createElement("div");
                tdiv.classList.add("cnt-wrp");
                tdiv.innerHTML = `<label class="fld-lbl" for="${tid}">Time ${state.count}</label><input type="time" class="txt-inp" id="${tid}" data-ms-member="${dy.toLowerCase()}-time-${state.count}" placeholder="08:30">`;
                ts.appendChild(tdiv);
                debouncedUpdateSaveButton(dv);
            });
            dv.querySelector(".clear-times-btn").addEventListener("click", () => {
                state.count = 3;
                state.times = {};
                ts.innerHTML = "";
                for (let j = 0; j < state.count; j++) {
                    const tid = `${id}-tm-${j + 1}`,
                          tdiv = document.createElement("div");
                    tdiv.classList.add("cnt-wrp");
                    tdiv.innerHTML = `<label class="fld-lbl" for="${tid}">Time ${j + 1}${j === 0 ? " *" : ""}</label><input type="time" class="txt-inp" id="${tid}" data-ms-member="${dy.toLowerCase()}-time-${j + 1}" placeholder="08:30"${j === 0 ? ' required' : ''}>`;
                    ts.appendChild(tdiv);
                }
                debouncedUpdateSaveButton(dv);
            });
            dv.querySelector(".rmv-cnt").addEventListener("click", (event) => {
                event.stopPropagation();
                const checkbox = c[w.indexOf(dy)];
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
                updateDynamicDays();
            });
            ts.querySelectorAll("input[type='time']").forEach((t, i) => {
                t.addEventListener("input", () => {
                    if (t.value) {
                        state.times[`time-${i + 1}`] = t.value;
                    } else {
                        delete state.times[`time-${i + 1}`];
                    }
                    debouncedUpdateSaveButton(dv);
                });
            });
            dv.querySelectorAll(".sv-btn[data-section]").forEach(btn => {
                btn.addEventListener("click", () => updateMemberData(btn));
            });
            debouncedUpdateSaveButton(dv);
        }

        function updateDynamicDays() {
            const checkedDays = Array.from(c).filter(x => x.checked).map(x => x.value);
            if (checkedDays.length > maxDays) {
                alert(`Your plan allows only ${maxDays} days`);
                const lastChecked = c[w.indexOf(checkedDays[checkedDays.length - 1])];
                lastChecked.checked = false;
                lastChecked.dispatchEvent(new Event('change'));
                return;
            }
            d.innerHTML = "";
            if (checkedDays.length > 0) {
                const firstDay = checkedDays[0];
                addDay(firstDay, 0);
            }
            debouncedUpdateSaveButton(document.getElementById("svc-sch-cnt"));
        }

        document.getElementById("day-mon").checked = true;
        updateDynamicDays();
    } catch (err) {
        console.error("Error in initSch:", err);
    }
}

function initEmg() {
    try {
        const cnts = document.getElementById("emg-cnts-cnt");
        let cc = 0;

        window.addCnt = function() {
            if (cc >= 6) {
                alert("Maximum of 6 emergency contacts reached");
                return;
            }
            cc++;
            const id = `cnt-${cc}`,
                  nw = ["one", "two", "three", "four", "five", "six"],
                  n = nw[cc-1],
                  div = document.createElement("div");
            div.classList.add("cnt-sec");
            div.setAttribute("id", id);
            div.innerHTML = `${cc > 1 ? '<button type="button" class="rmv-cnt">✕</button>' : ''}<div class="cnt-hdr">Emergency Contact ${cc}</div><div class="cnt-row"><div class="cnt-wrp"><label class="fld-lbl" for="${id}-fname">First Name *</label><input type="text" class="txt-inp" id="${id}-fname" data-ms-member="contact-${n}-first-name" placeholder="First Name" required></div><div class="cnt-wrp"><label class="fld-lbl" for="${id}-lname">Last Name *</label><input type="text" class="txt-inp" id="${id}-lname" data-ms-member="contact-${n}-last-name" placeholder="Last Name" required></div><div class="cnt-wrp phone-wrp"><label class="fld-lbl" for="${id}-ph">Phone Number *</label><input type="text" class="txt-inp" id="${id}-ph" ms-code-phone-number="gb,ie" data-ms-member="contact-${n}-mobile-number" placeholder="Enter phone number" required></div></div><div class="btn-wrapper"><button type="button" class="add-cnt-btn">Add Contact</button><button type="button" class="sv-btn" data-section="emg-cnt-${cc}">Save</button></div>`;
            cnts.appendChild(div);
            const phoneInput = div.querySelector(`#${id}-ph`);
            const iti = window.intlTelInput(phoneInput, {
                preferredCountries: ["gb", "ie"],
                utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
            });
            phoneInput.addEventListener('change', () => {
                phoneInput.value = iti.getNumber(intlTelInputUtils.numberFormat.INTERNATIONAL);
                debouncedUpdateSaveButton(div);
            });
            phoneInput.addEventListener('keyup', () => {
                phoneInput.value = iti.getNumber(intlTelInputUtils.numberFormat.INTERNATIONAL);
                debouncedUpdateSaveButton(div);
            });
            div.querySelector(".add-cnt-btn").addEventListener("click", addCnt);
            div.querySelector(".sv-btn").addEventListener("click", () => updateMemberData(div.querySelector(".sv-btn")));
            if (cc > 1) {
                div.querySelector(".rmv-cnt").addEventListener("click", () => {
                    div.remove();
                    cc--;
                    const rem = cnts.querySelectorAll(".cnt-sec");
                    rem.forEach((c, i) => {
                        const ni = i + 1,
                              nn = nw[ni-1];
                        c.setAttribute("id", `cnt-${ni}`);
                        c.querySelector(".cnt-hdr").textContent = `Emergency Contact ${ni}`;
                        const inps = c.querySelectorAll("input");
                        inps[0].setAttribute("id", `cnt-${ni}-fname`);
                        inps[0].setAttribute("data-ms-member", `contact-${nn}-first-name`);
                        inps[1].setAttribute("id", `cnt-${ni}-lname`);
                        inps[1].setAttribute("data-ms-member", `contact-${nn}-last-name`);
                        inps[2].setAttribute("id", `cnt-${ni}-ph`);
                        inps[2].setAttribute("data-ms-member", `contact-${nn}-mobile-number`);
                        c.querySelector(".sv-btn").setAttribute("data-section", `emg-cnt-${ni}`);
                        debouncedUpdateSaveButton(c);
                    });
                    debouncedUpdateSaveButton(document.getElementById("emg-cnts"));
                });
            }
            ms.getCurrentMember().then(({ data: m }) => {
                if (m) prefillPh(`${id}-ph`, m.customFields[`contact-${n}-mobile-number`]);
            });
            div.querySelectorAll("input").forEach(inp => {
                inp.addEventListener("input", () => debouncedUpdateSaveButton(div));
            });
            debouncedUpdateSaveButton(div);
        }

        addCnt();
        debouncedUpdateSaveButton(document.getElementById("emg-cnts"));
    } catch (err) {
        console.error("Error in initEmg:", err);
    }
}

async function updateMemberData(btn) {
    try {
        const sec = btn.closest(".nst-sec-cnt") || btn.closest(".day-sec") || btn.closest(".cnt-sec"),
              btnSec = btn.getAttribute("data-section"),
              isDaySec = btnSec.startsWith("sch-day-"),
              isEmgCnt = btnSec.startsWith("emg-cnt-"),
              targetSec = isDaySec || isEmgCnt ? sec : sec.querySelector(`#${btnSec}-cnt`) || sec;
        
        document.getElementBy