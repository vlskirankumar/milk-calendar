import React, { useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { ClassName, TileArgs } from 'react-calendar/dist/cjs/shared/types';


type Shift = ("Morning" | "Evening");

type VendorNames = ("Farm" | "Venkateswara Rao");

type Vendor = {
    name: VendorNames;
    shifts: { [shift in Shift]: boolean | number };
    price: number;
}

const vendors: Vendor[] = [{ "name": "Farm", shifts: { "Morning": true, "Evening": true }, price: 90 },
{ "name": "Venkateswara Rao", shifts: { "Morning": false, "Evening": true }, price: 90 }];

const defaultVendorData: Vendor[] = vendors.map(vendor => {
    return {
        name: vendor.name,
        shifts: { "Morning": 0, "Evening": 0 }
    } as Vendor;
});

interface Event {
    date: string;
    data: Vendor[];
};

const calculateTotalCost = (events: Event[], firstDate: Date, lastDate: Date): Vendor[] => {
    const currentMonthEvents = events.filter(event => {
        return new Date(event.date) >= firstDate && new Date(event.date) <= lastDate;
    });
    return currentMonthEvents.reduce((prev, event) => {
        return [...event.data.reduce((prev, vendor) => {
            const price = vendors.find(v => v.name === vendor.name)?.price ?? 0;
            const totalLiters = (vendor.shifts.Morning as number) + (vendor.shifts.Evening as number);
            const cost = price * totalLiters;
            const existEvent = prev.find(v => v.name == vendor.name);
            if (existEvent) {
                existEvent.price += cost;
            } else {
                prev.push({ name: vendor.name, price: cost } as Vendor);
            }
            return [...prev];
        }, prev)];
    }, [] as Vendor[]);
};

const CalendarComponent = () => {
    const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem("milkPantryApiKey"));
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [deliveryData, setDeliveryData] = useState<Vendor[]>(defaultVendorData);
    const [showDialog, setShowDialog] = useState<boolean>(false);
    const [events, setEvents] = useState<Event[]>(JSON.parse(localStorage.getItem("attendanceData") ?? "[]"));
    const [noAPI, setNoAPI] = useState<boolean>(false);

    const [firstDate, lastDate] = useMemo(() => {
        const today = new Date();
        return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth() + 1, 0)];
    }, []);

    const totalCostCurrentMonth = useMemo(() => {
        const currentMonthFirstDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
        return calculateTotalCost(events, currentMonthFirstDate, lastDate);
    }, [events]);

    const totalCostPreviousMonth = useMemo(() => {
        const previousMonthLastDate = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);
        return calculateTotalCost(events, firstDate, previousMonthLastDate);
    }, [events]);

    const fetchData = async () => {
        if (apiKey) {
            try {
                let resp = await fetch(`https://getpantry.cloud/apiv1/pantry/${apiKey}/basket/milk`, { method: "GET" });
                let j = await resp.json();
                const eventsData = j.data as Event[];
                if (eventsData && eventsData.length > 0) {
                    setEvents(eventsData.filter(e => {
                        const dt = new Date(e.date);
                        return (dt <= lastDate) && (dt >= firstDate)
                    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                    setNoAPI(false);
                }
            } catch (err) {
                alert(err);
                setNoAPI(true);
            }
        }
    };

    useEffect(() => {
        localStorage.setItem("attendanceData", JSON.stringify(events));
    }, [events]);

    useEffect(() => {
        fetchData();
    }, [apiKey, firstDate, lastDate]);

    const saveToPantry = async () => {
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        const raw = JSON.stringify({ "data": events });
        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        } as RequestInit;
        try {
            await fetch(`https://getpantry.cloud/apiv1/pantry/${apiKey}/basket/milk`, requestOptions);
            alert("Saved Successfully!");
            setNoAPI(false);
        } catch (err) {
            alert(err);
            setNoAPI(true);
        }
    };

    const downloadJson = async () => {
        const json = JSON.stringify(events, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);

        // create "a" HTLM element with href to file
        const link = document.createElement("a");
        link.href = href;
        link.download = "attendance.json";
        document.body.appendChild(link);
        link.click();

        // clean up "a" element & remove ObjectURL
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    };

    const loadJson = async (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        let reader = new FileReader();
        reader.onload = (event) => {
            try {
                let fileObj = JSON.parse(event.target?.result?.toString() ?? "[]") as Event[];
                if (fileObj && Array.isArray(fileObj) && fileObj.length > 0 && fileObj[0].date !== undefined) {
                    setEvents(fileObj);
                } else {
                    alert("inValid Json Data file provided!");
                }
            } catch (err) {
                alert("inValid Json Data file provided!");
                alert(err);
            }

        };

        reader.onerror = (event) => {
            alert("inValid Json Data file provided!");
            alert(event.target?.error);
        };

        if (changeEvent.target.files && changeEvent.target.files.length > 0) {
            try {
                reader.readAsText(changeEvent.target.files[0]);
            } catch (err) {
                alert("inValid Json Data file provided!");
                alert(err);
            }
        }
    };

    const handleDateClick = (date: Date, event: React.MouseEvent<HTMLButtonElement>) => {
        setShowDialog(true);
        setSelectedDate(date.toDateString());
        const existEvent = events.find(e => e.date === date.toDateString());
        if (existEvent) {
            setDeliveryData(existEvent.data);
        }
    };

    const getDateStyle = ({ activeStartDate, date, view }: TileArgs): ClassName => {
        if (view === "month") {
            if (date.toLocaleDateString() === new Date().toLocaleDateString()) {
                return "react-calendar__tile--now";
            }
            return "react-calendar__tile--active";
        }
    };

    const getDateContent = ({ activeStartDate, date, view }: TileArgs): React.ReactNode => {
        if (view === "month") {
            const event = events.find(e => e.date === date.toDateString());
            if (event) {
                const totalLiters = event.data?.reduce((prev, vendor) => {
                    return `${prev}${(vendor.shifts.Evening as number) + (vendor.shifts.Morning as number)}L `;
                }, "");
                return <p>{totalLiters}</p>;
            } else {
                return <p>0L</p>;
            }
        }
        return <></>;
    };

    const onInputChange = (changeEvent: React.ChangeEvent<HTMLInputElement>, vendorName: VendorNames, shift: Shift) => {
        setDeliveryData(prev => {
            return prev.map(vendor => {
                if (vendor.name === vendorName) {
                    return {
                        ...vendor,
                        name: vendor.name,
                        shifts: {
                            ...vendor.shifts,
                            [shift]: Number(changeEvent.target.value ?? 0)
                        }
                    } as Vendor;
                } else {
                    return { ...vendor } as Vendor;
                }
            });
        });
    };

    const handleOkClick = () => {
        setShowDialog(false);
        const updatedEvents = events.filter(e => e.date !== selectedDate);
        if (deliveryData) {
            updatedEvents.push({ date: selectedDate, data: deliveryData });
        }
        setEvents([...updatedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())]);
    };

    const handleCancelClick = () => {
        setShowDialog(false);
    };

    if (apiKey) {
        return <div>
            <h1>Milk Calendar</h1>
            {
                showDialog ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <p>{selectedDate}</p>
                    <table border={2}>
                        <tbody>
                            <tr>
                                <th></th>
                                <th><p>Morning</p></th>
                                <th><p>Evening</p></th>
                            </tr>
                            {
                                vendors.map(vendor => {
                                    return (<tr>
                                        <th><p>{vendor.name}</p></th>
                                        <td>{vendor.shifts.Morning ? <input style={{width: '3ch'}} type='number' defaultValue={deliveryData.find(x => x.name === vendor.name)?.shifts.Morning as number}
                                            onChange={e => onInputChange(e, vendor.name, "Morning")} /> : <p />}</td>
                                        <td>{vendor.shifts.Evening ? <input style={{width: '3ch'}} type='number' defaultValue={deliveryData.find(x => x.name === vendor.name)?.shifts.Evening as number}
                                            onChange={e => onInputChange(e, vendor.name, "Evening")} /> : <p />}</td>
                                    </tr>)
                                })
                            }
                        </tbody>
                    </table>
                    <br />
                    <span>
                        <input type='button' value="Ok" onClick={handleOkClick} style={{ marginRight: "1vw" }} />
                        <input type='button' value="Cancel" onClick={handleCancelClick} />
                    </span>
                </div> : <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div>
                        <Calendar onClickDay={handleDateClick} maxDate={lastDate} minDate={firstDate}
                            tileClassName={getDateStyle} tileContent={getDateContent} />
                        <br />
                        <input type='button' value="Save" onClick={saveToPantry} />
                        <br />
                        <br />
                        <table border={2}>
                            <tbody>
                                <tr>
                                    <th></th>
                                    <th><p>{firstDate.toLocaleString('default', { month: 'long' })}</p></th>
                                    <th><p>{lastDate.toLocaleString('default', { month: 'long' })}</p></th>
                                </tr>
                                {vendors.map(vendor => <tr key={vendor.name}>
                                    <th><p>{vendor.name}</p></th>
                                    <td><p>{totalCostPreviousMonth.find(v => v.name === vendor.name)?.price ?? 0}/-</p></td>
                                    <td><p>{totalCostCurrentMonth.find(v => v.name === vendor.name)?.price ?? 0}/-</p></td>
                                </tr>)}
                            </tbody>
                        </table>
                        <br />
                    </div>
                    <div>
                        {
                            noAPI &&
                            <div>
                                <input type='button' value="Download Data" onClick={downloadJson} />
                                <input type='file' onChange={loadJson} />
                            </div>
                        }
                        <br />
                    </div>
                </div>
            }
        </div>
    } else {
        return <div style={{ margin: "auto", marginTop: "30vh" }}>
            <input size={32} onChange={e => {
                const regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[4][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
                if (regex.test(e.target.value)) {
                    setApiKey(e.target.value);
                    localStorage.setItem("milkPantryApiKey", e.target.value);
                }
            }} placeholder='Please Enter Pantry API Key!' />
        </div>
    }
};

export default CalendarComponent;
